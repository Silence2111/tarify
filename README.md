# Тарифы — MVP агрегатора интернет-провайдеров по адресу

Платформа сравнения тарифов: пользователь вводит адрес → видит провайдеров, доступных в его доме → оставляет заявку на подключение. Бесплатна для пользователя; доход — комиссия провайдера за подтверждённое подключение (CPA, ~1000–2750 ₽, см. `research/`).

Стек: **Next.js 15 (App Router, TS) + PostgreSQL + Prisma + Tailwind**.

## Что внутри

| Часть | Где | Зачем |
|---|---|---|
| Модель данных | [prisma/schema.prisma](prisma/schema.prisma) | Ядро «тариф» (Provider→Plan→Option) + адрес (City/Street/Building) + **Coverage** (матрица «дом×провайдер») + **Lead** (воронка денег) |
| Поиск по адресу | [components/AddressSearch.tsx](components/AddressSearch.tsx) | Город + улица (автокомплит) + дом |
| Адресный слой | [lib/dadata.ts](lib/dadata.ts) | Автокомплит улиц через DaData (ФИАС/ГАР) при `DADATA_API_KEY`, иначе локальная база |
| Подбор по покрытию | [lib/coverage.ts](lib/coverage.ts) | Главный запрос: какие провайдеры доступны по адресу |
| Сравнение + фильтры | [components/ResultsList.tsx](components/ResultsList.tsx) | Фильтр по цене/скорости/ТВ, сортировка |
| Заявка | [components/LeadForm.tsx](components/LeadForm.tsx) → [app/api/leads/route.ts](app/api/leads/route.ts) | Захват лида |
| Гео-SEO | [app/[city]/page.tsx](app/[city]/page.tsx) | Страница под город — органический трафик |
| Заявки (админка) | [app/admin/leads/page.tsx](app/admin/leads/page.tsx) | Воронка, статусы, аппрув, выручка по `payoutRub` |
| Покрытие (админка) | [app/admin/coverage/page.tsx](app/admin/coverage/page.tsx) + [lib/coverage-import.ts](lib/coverage-import.ts) | Статистика матрицы дом×провайдер + импорт CSV-фидов |

Маршруты: `/` · `/[city]` (гео-SEO) · `/[city]/search?street=&house=` (результаты) · `/admin/leads`.

## Запуск

> ⚠️ На текущей машине **не установлены Node.js и PostgreSQL** — без них приложение не запустится. См. раздел «Установка окружения» ниже.

> ℹ️ Если в окружении выставлен `NODE_ENV=production`, npm пропускает devDependencies
> (tailwindcss, postcss, tsx) — сборка упадёт с `Cannot find module 'tailwindcss'`.
> Тогда ставьте с `npm install --include=dev`. Скрипт `dev` уже форсит `NODE_ENV=development`.

**Вариант A — локальный Postgres без установки (быстрее всего).** Нативный arm64-бинарник из `embedded-postgres`, данные в `./.pgdata`:

```bash
npm install --include=dev        # из-за NODE_ENV=production в окружении нужен --include=dev

npm run db:local                 # поднимает локальный Postgres на :5433, держать в отдельном терминале
# .env уже указывает на postgresql://postgres:postgres@localhost:5433/tarify

npm run db:push                  # создать таблицы
npm run db:seed                  # залить Казань: 5 провайдеров, улицы, покрытие
npm run dev                      # http://localhost:3000
```

**Вариант B — внешний Postgres (Neon/Supabase).** Скопировать `.env.example` → `.env`, вписать свою `DATABASE_URL`, затем `npm run db:push && npm run db:seed && npm run dev`.

Полезное: `npm run db:studio` — визуальный редактор БД; `npm run db:reset` — пересоздать и пересеять.

**Импорт фида покрытия из CLI** (для cron/ручной заливки, идёт через защищённый эндпоинт):

```bash
ADMIN_PASSWORD=secret SITE_URL=http://localhost:3000 \
  npm run import-coverage -- data/coverage-sample.csv rostelecom-feed
```

**Прод-харднинг** (готово): сессионная cookie админки `secure` под HTTPS (в проде); rate-limit на создание заявок (5/мин на IP) и вход в админку (10/5мин); у записей покрытия есть `source` и `updatedAt` — повторный импорт освежает актуальность, в `/admin/coverage` видны источники и свежесть. Перед деплоем: сменить `ADMIN_PASSWORD`/`ADMIN_SECRET`, выставить `NEXT_PUBLIC_SITE_URL`; для нескольких инстансов заменить in-memory rate-limit на Redis.

### Демо-сценарий
1. На главной выбрать «Казань», улицу (например, «Баумана»), дом «3» → **Проверить**.
2. Появятся провайдеры этого дома с тарифами; отфильтровать по цене/скорости.
3. Нажать **Подключить**, оставить имя+телефон.
4. Открыть `/admin/leads` — заявка там.

## Установка окружения (macOS, без Homebrew)

Нужны Node.js 20+ и доступ к PostgreSQL.

- **Node.js**: скачать официальный установщик с https://nodejs.org (LTS, .pkg для macOS) — это самый простой путь без Homebrew. После установки `node -v` должен работать.
- **PostgreSQL**: для локалки не обязателен — быстрее завести бесплатную базу на [Neon](https://neon.tech) или [Supabase](https://supabase.com) и вставить строку подключения в `.env`. Если нужен локальный — установить [Postgres.app](https://postgresapp.com).

## Дорожная карта (после MVP)

- **Покрытие по адресам** — главный барьер: партнёрские фиды топ-провайдеров + DaData API для адресного слоя (ФИАС/ГАР). Сейчас покрытие — демо-сид.
- **Колл-центр / статусы заявок** — обработка лида определяет аппрув, а значит выручку. Добавить смену статусов и экспорт в CPA-сеть.
- **Интеграция с CPA-сетью** (Pampadu/Admitad) — выплаты без прямых договоров.
- **Масштаб гео-страниц** под низкочастотные запросы «провайдеры по адресу» — основной канал органики.

Исследование рынка и юнит-экономики — в [research/](research/) (два Word-отчёта + скрипты-генераторы).
