#!/usr/bin/env bash
# Установка сайта «Тарифы» на свой сервер: Ubuntu 22.04 или 24.04, от root.
# Как запустить — DEPLOY-RU.md: репозиторий клонируется в /opt/tarify/repo, затем
#   bash /opt/tarify/repo/deploy/install.sh
#
# Ставит Node.js 22, PostgreSQL 17 и nginx; создаёт базу и .env; собирает сайт;
# включает автообновление из GitHub (каждые 5 минут), ночные копии базы и HTTPS — если
# домен уже указывает на этот сервер. Повторный запуск ничего не ломает: сделанное
# пропускается, пароль базы и переменные сохраняются.
set -euo pipefail

BASE=/opt/tarify
REPO=$BASE/repo
DEPLOY=$REPO/deploy
KEY=$BASE/.ssh/deploy_key

step() { printf '\n== %s\n' "$*"; }
ask() {
  local answer
  read -rp "$1" answer < /dev/tty
  printf '%s' "$answer"
}

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root: sudo -i, затем эту же команду."; exit 1; }
[ "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" = "$REPO" ] ||
  { echo "Репозиторий должен лежать в $REPO — см. DEPLOY-RU.md."; exit 1; }
# shellcheck source=/dev/null
. /etc/os-release
[ "${ID:-}" = ubuntu ] || { echo "Нужна Ubuntu 22.04 или 24.04."; exit 1; }

# Общие функции и пути (env_get, env_set, die, as_app…) — из скрипта управления.
# shellcheck source=deploy/tarify.sh
. "$DEPLOY/tarify.sh"

# --- Вопросы: только при первой установке -----------------------------------------

DOMAIN=$(site_host)
SOURCE_DB=""
if [ -z "$DOMAIN" ]; then
  DOMAIN=$(ask "Домен сайта, например tarify.rumedia-cdn.com: ")
  DOMAIN=${DOMAIN#*://}
  DOMAIN=${DOMAIN%%/*}
  DOMAIN=${DOMAIN,,}
  [[ $DOMAIN =~ ^[a-z0-9.-]+\.[a-z0-9-]{2,}$ ]] || die "не похоже на домен: $DOMAIN (кириллический — в виде xn--…)"
  say "Перенести данные с нынешнего сайта? Вставьте строку подключения к базе Neon"
  say "(Vercel → Settings → Environment Variables → DIRECT_URL) или нажмите Enter —"
  SOURCE_DB=$(ask "тогда сайт начнёт с демо-данных: ")
fi

# --- Пакеты -----------------------------------------------------------------------

step "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl git openssh-client nginx certbot python3-certbot-nginx cron openssl

if ! command -v node > /dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
say "Node.js $(node -v)"

# PostgreSQL 17 из репозитория postgresql.org: его pg_dump скачает и базу Neon на 17-й
# версии. Если репозиторий недоступен — версия из Ubuntu.
if ! compgen -G "/usr/lib/postgresql/*/bin/postgres" > /dev/null; then
  install -d /usr/share/postgresql-common/pgdg
  if curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc; then
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list
    apt-get update -q
  fi
  apt-get install -y -q postgresql-17 || {
    rm -f /etc/apt/sources.list.d/pgdg.list
    apt-get update -q
    apt-get install -y -q postgresql
  }
fi
systemctl enable --now postgresql
say "$(psql --version)"

# --- Подкачка: сборке сайта нужно ~2 ГБ памяти --------------------------------------

step "Память для сборки"
if [ -z "$(swapon --show --noheadings)" ] && [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 3500000 ]; then
  created=0
  if [ ! -e /swapfile ] &&
    { fallocate -l 2G /swapfile 2> /dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none; }; then
    created=1
    chmod 600 /swapfile
    mkswap /swapfile > /dev/null || true
  fi
  if [ -e /swapfile ] && swapon /swapfile 2> /dev/null; then
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    say "Добавил 2 ГБ подкачки."
  else
    # Не вышло (на части VPS подкачка запрещена) — не оставляем на диске пустые 2 ГБ.
    if [ "$created" = 1 ]; then rm -f /swapfile; fi
    warn "подкачку включить не удалось — на сервере с 1–2 ГБ памяти сборка может не пройти"
  fi
else
  say "Памяти хватает."
fi

# --- Пользователь сайта и доступ к GitHub ---------------------------------------------

step "Доступ к GitHub"
id tarify > /dev/null 2>&1 || useradd --system --home-dir "$BASE" --shell /usr/sbin/nologin tarify
install -d -o tarify -g tarify "$BASE" "$RELEASES" "$SHARED"
install -d -o tarify -g tarify -m 700 "$BASE/.ssh"
if [ ! -f "$KEY" ]; then
  if [ -f /root/.ssh/tarify_deploy ]; then
    install -o tarify -g tarify -m 600 /root/.ssh/tarify_deploy "$KEY"
    install -o tarify -g tarify -m 644 /root/.ssh/tarify_deploy.pub "$KEY.pub"
  else
    as_app ssh-keygen -t ed25519 -N "" -C tarify-server -f "$KEY" -q
  fi
fi
chown -R tarify:tarify "$REPO"
as_app git -C "$REPO" config core.sshCommand "ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
origin=$(as_app git -C "$REPO" remote get-url origin)
case $origin in
  https://github.com/*) as_app git -C "$REPO" remote set-url origin "git@github.com:${origin#https://github.com/}" ;;
esac
until as_app git -C "$REPO" ls-remote --exit-code origin "$BRANCH" > /dev/null 2>&1; do
  say "Сервер не может читать репозиторий. Добавьте его ключ на GitHub: репозиторий →"
  say "Settings → Deploy keys → Add deploy key, галочку «Allow write access» не ставьте:"
  say ""
  cat "$KEY.pub"
  say ""
  ask "Нажмите Enter, когда добавите ключ… " > /dev/null
done
say "Доступ есть."

# --- База и настройки -------------------------------------------------------------

step "База данных"
db_pass=$(env_get DATABASE_URL | sed -nE 's#^postgresql://tarify:([^@]+)@.*#\1#p')
[ -n "$db_pass" ] || db_pass=$(openssl rand -hex 24)
(cd / && runuser -u postgres -- psql -q -v ON_ERROR_STOP=1) << SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tarify') THEN CREATE ROLE tarify; END IF;
END \$\$;
ALTER ROLE tarify WITH LOGIN PASSWORD '$db_pass';
SQL
if [ "$(cd / && runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'tarify'")" != 1 ]; then
  (cd / && runuser -u postgres -- createdb -O tarify tarify)
fi
say "База tarify готова, пароль — в $ENV_FILE."

if [ ! -f "$ENV_FILE" ]; then
  install -m 600 -o tarify -g tarify /dev/null "$ENV_FILE"
  cat >> "$ENV_FILE" << EOF
# Переменные сайта. Менять командой: tarify env КЛЮЧ ЗНАЧЕНИЕ — она пересоберёт сайт.
DATABASE_URL="postgresql://tarify:$db_pass@127.0.0.1:5432/tarify"
DIRECT_URL="postgresql://tarify:$db_pass@127.0.0.1:5432/tarify"
NEXT_PUBLIC_SITE_URL="https://$DOMAIN"
NEXT_PUBLIC_DEMO="1"
EOF
fi

# --- Сервисы ---------------------------------------------------------------------

step "Сервисы"
install -m 644 "$DEPLOY/systemd/tarify.service" "$DEPLOY/systemd/tarify-update.service" \
  "$DEPLOY/systemd/tarify-update.timer" /etc/systemd/system/
systemctl daemon-reload
# Конфиг nginx пишем один раз: потом в него допишет HTTPS certbot.
if [ ! -f /etc/nginx/sites-available/tarify ]; then
  sed "s/__DOMAIN__/$DOMAIN/g" "$DEPLOY/nginx.conf" > /etc/nginx/sites-available/tarify
fi
ln -sfn /etc/nginx/sites-available/tarify /etc/nginx/sites-enabled/tarify
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
systemctl reload-or-restart nginx
printf '%s\n' "# Ночная копия базы сайта «Тарифы»" "30 3 * * * root /usr/local/bin/tarify backup > /dev/null 2>&1" \
  > /etc/cron.d/tarify

step "Сборка сайта — 5–10 минут"
bash "$DEPLOY/tarify.sh" update
ln -sfn "$CURRENT/deploy/tarify.sh" /usr/local/bin/tarify
systemctl enable tarify tarify-update.timer
systemctl start tarify-update.timer

step "Данные"
if [ -n "$SOURCE_DB" ]; then
  tarify import-db "$SOURCE_DB" --yes
elif [ "$(psql --dbname="$(env_get DATABASE_URL)" -tAc 'SELECT count(*) FROM "Provider"')" = 0 ]; then
  say "База пустая — заливаю демо-данные, как на нынешнем сайте."
  # shellcheck disable=SC2016
  as_app bash -c 'cd "$1" && npm run db:seed' _ "$CURRENT"
else
  say "Данные уже есть."
fi

step "HTTPS"
https_ok=1
tarify https || https_ok=0

step "Готово"
if [ "$https_ok" = 1 ]; then
  say "Сайт:     https://$DOMAIN"
else
  say "Сайт:     http://$(public_ip) — до переключения домена; админка заработает после HTTPS"
fi
say "Админка:  /admin/login, пароль прежний"
say "Команды:  tarify status | update | rollback | env | https | backup | logs"
say "Перенести переменные из Vercel: tarify env --paste"
say "Копии базы — каждую ночь в $BACKUPS"
