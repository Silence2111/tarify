# Деплой: Vercel + Neon

Гайд по выкатке MVP в прод. Стек хостинга: **Vercel** (Next.js) + **Neon** (PostgreSQL).
Время на всё — ~30–40 минут.

## TL;DR

1. Создать БД на Neon → получить две строки подключения (pooled + direct).
2. Запушить репозиторий на GitHub.
3. Импортировать репо в Vercel, прописать env-переменные.
4. Применить схему к Neon (`prisma db push`) и залить покрытие (CLI-импорт).
5. Привязать домен — `secure`-cookie и HTTPS включатся сами.
6. Заменить in-memory rate-limit на Upstash Redis (важно для serverless).

---

## 1. Neon — база данных

1. Зарегистрироваться на [neon.tech](https://neon.tech), создать проект (регион — ближе к пользователям, напр. EU).
2. В дашборде проекта → **Connection string**. Понадобятся ДВЕ строки:
   - **Pooled** (хост с `-pooler`) — для рантайма приложения (serverless создаёт много коннектов).
   - **Direct** (хост без `-pooler`) — для миграций/`db push`.

   Пример:
   ```
   # pooled (runtime)
   postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   # direct (migrations)
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

### Рекомендуется: directUrl в схеме

Чтобы миграции шли по прямому подключению, а рантайм — по пулу, добавьте в
[prisma/schema.prisma](prisma/schema.prisma) в блок `datasource db`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled — рантайм
  directUrl = env("DIRECT_URL")     // direct — миграции/db push
}
```

Локально (embedded-postgres) просто выставьте `DIRECT_URL` равным `DATABASE_URL` —
пул там не используется.

---

## 2. Подготовка репозитория

```bash
git init && git add -A && git commit -m "MVP тарифов"
# создать репозиторий на GitHub и:
git remote add origin git@github.com:<you>/tarify.git
git push -u origin main
```

В проекте уже готово к деплою:
- `postinstall: prisma generate` в [package.json](package.json) — Vercel сгенерит клиент при сборке.
- `.gitignore` исключает `.env`, `.next`, `node_modules`, `.pgdata`.

> ⚠️ `embedded-postgres` — это **локальный** инструмент (только `scripts/local-db.mjs`).
> На Vercel он не нужен; он в devDependencies и тянет ~50 МБ бинарник при install.
> Чтобы не замедлять сборку, можно перенести его в `optionalDependencies` или удалить,
> если локальный Postgres больше не нужен.

---

## 3. Vercel — импорт и переменные окружения

1. [vercel.com](https://vercel.com) → **Add New → Project** → импортировать GitHub-репо.
2. Framework Preset определится как **Next.js** автоматически. Build/Output менять не нужно.
3. **Settings → Environment Variables** (для Production, по желанию и Preview):

   | Переменная | Значение | Зачем |
   |---|---|---|
   | `DATABASE_URL` | Neon **pooled** строка | рантайм-подключение |
   | `DIRECT_URL` | Neon **direct** строка | миграции (если добавили directUrl) |
   | `ADMIN_PASSWORD` | надёжный пароль | вход в `/admin` |
   | `ADMIN_SECRET` | случайная строка | подпись сессионной cookie |
   | `NEXT_PUBLIC_SITE_URL` | `https://ваш-домен` | canonical, sitemap, robots |
   | `DADATA_API_KEY` | (необязательно) | автокомплит адресов по всей РФ |

4. **Deploy**. `NODE_ENV=production` Vercel выставит сам → `secure`-cookie активируется.

---

## 4. Применить схему и наполнить данные

Схему к Neon удобнее применить **локально**, указав прод-строку (одноразово):

```bash
# direct-строка Neon (без -pooler)
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npx prisma db push
```

Наполнение:

- ⚠️ **НЕ запускайте `npm run db:seed` на проде** — сид делает `deleteMany` и затирает все данные. Он только для локалки/демо.
- Реальное покрытие заливайте CLI-импортом против прод-домена:
  ```bash
  ADMIN_PASSWORD=<прод-пароль> SITE_URL=https://ваш-домен \
    npm run import-coverage -- feeds/rostelecom.csv rostelecom-feed
  ```
  Формат CSV — см. [data/coverage-sample.csv](data/coverage-sample.csv). Повторный импорт
  освежает `updatedAt`, дубли не создаёт.

Проверка после деплоя: открыть `https://домен/`, найти адрес, оставить заявку, войти в
`/admin/leads` (пароль из `ADMIN_PASSWORD`), глянуть `/admin/coverage`.

---

## 5. Домен и HTTPS

- Vercel выдаёт `*.vercel.app` сразу (HTTPS из коробки).
- Свой домен: **Settings → Domains** → добавить, прописать DNS у регистратора.
- После привязки домена обновите `NEXT_PUBLIC_SITE_URL` на него и сделайте redeploy
  (чтобы sitemap/canonical указывали на боевой адрес).

---

## 6. Важные нюансы прод-окружения

- **Rate-limit на serverless.** Текущий лимитер in-memory ([lib/rate-limit.ts](lib/rate-limit.ts)) —
  на Vercel каждый инстанс свой, поэтому лимит фактически не работает между инстансами.
  Для реальной защиты подключите **Upstash Redis** (есть интеграция в Vercel Marketplace) и
  замените `rateLimit()` на счётчик в Redis. До этого rate-limit спасает только на одном инстансе.
- **Prisma + serverless коннекты.** Обязательно используйте **pooled** строку Neon в `DATABASE_URL`,
  иначе можно упереться в лимит подключений. Миграции — по `DIRECT_URL`.
- **Миграции.** Сейчас используется `prisma db push` (без истории миграций) — ок для MVP.
  Для команды лучше перейти на `prisma migrate` (папка `prisma/migrations`) и в CI гонять
  `prisma migrate deploy`.
- **Сид затирает данные** — на проде только CLI-импорт, не `db:seed`.
- **Секреты.** Смените `ADMIN_PASSWORD` и `ADMIN_SECRET` (смена `ADMIN_SECRET` инвалидирует
  активные сессии админки — это норм).
- **Middleware** работает на Vercel Edge (использует Web Crypto — совместимо).

---

## 7. Чек-лист перед продом

- [ ] Neon: pooled + direct строки получены
- [ ] (рекоменд.) `directUrl` добавлен в schema, `DIRECT_URL` в env
- [ ] Env на Vercel: `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, `NEXT_PUBLIC_SITE_URL`
- [ ] `prisma db push` применён к Neon
- [ ] Покрытие залито CLI-импортом (не сидом)
- [ ] Зашёл в `/admin` под прод-паролем, заявка создаётся и видна
- [ ] Домен привязан, `NEXT_PUBLIC_SITE_URL` обновлён, redeploy
- [ ] (важно) rate-limit переведён на Upstash Redis
- [ ] `robots.txt` и `sitemap.xml` отдаются с боевого домена
