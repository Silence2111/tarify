#!/usr/bin/env bash
# Управление сайтом «Тарифы» на своём сервере. Ставится установщиком deploy/install.sh
# и вызывается от root как `tarify <команда>`:
#
#   tarify status               версия сайта, автообновление, последняя копия базы
#   tarify update [--force]     обновиться до свежего main из GitHub — таймер делает это
#                               сам каждые 5 минут; --force пересобирает и без новых коммитов
#   tarify rollback             вернуть предыдущую версию
#   tarify env                  список переменных; tarify env КЛЮЧ — значение одной
#   tarify env КЛЮЧ ЗНАЧЕНИЕ    задать (можно несколько пар; пустое значение — удалить)
#                               и пересобрать сайт; tarify env --paste — вставить списком
#   tarify https                включить HTTPS, когда домен уже указывает на этот сервер
#   tarify backup               копия базы в /var/backups/tarify (каждую ночь — сама)
#   tarify import-db СТРОКА     заменить базу копией другой (перенос из Neon) или файлом
#                               из /var/backups/tarify
#   tarify logs [-f]            журнал сайта и обновлений
#
# Версии лежат в /opt/tarify/releases, работает та, на которую указывает
# /opt/tarify/current. Новая собирается рядом и включается, только если собралась и
# отвечает; иначе остаётся прежняя, а в Telegram приходит сообщение (если задан бот).
set -euo pipefail

BASE=${TARIFY_BASE:-/opt/tarify}
REPO=$BASE/repo
SHARED=$BASE/shared
ENV_FILE=$SHARED/.env
RELEASES=$BASE/releases
CURRENT=$BASE/current
BACKUPS=${TARIFY_BACKUPS:-/var/backups/tarify}
LOCK=${TARIFY_LOCK:-/run/tarify-update.lock}
PORT=${TARIFY_PORT:-3000}
BRANCH=main
KEEP_RELEASES=3
KEEP_BACKUPS=14
# Для проверки на другой машине: от чьего имени собирать (пусто — от текущего) и чем
# управлять сервисом.
read -ra AS_APP <<< "${TARIFY_AS_APP-runuser -u tarify -- env HOME=$BASE}"
SYSTEMCTL=${TARIFY_SYSTEMCTL:-systemctl}

say() { printf '%s\n' "$*"; }
warn() { printf 'Внимание: %s\n' "$*" >&2; }
die() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }
as_app() { "${AS_APP[@]}" "$@"; }

# --- Переменные окружения (.env) -------------------------------------------------

env_get() {
  [ -f "$ENV_FILE" ] || return 0
  local line
  line=$(grep -E "^$1=" "$ENV_FILE" | tail -n 1) || return 0
  line=${line#*=}
  case $line in
    \"*\" | \'*\') line=${line:1:${#line}-2} ;;
  esac
  printf '%s' "$line"
}

# Next.js подставляет $ПЕРЕМЕННЫЕ в значения .env, поэтому «$» не пропускаем; значение
# с двойными кавычками пишем в одинарных.
env_set() {
  local key=$1 val=$2 q='"' tmp
  [[ $key =~ ^[A-Z][A-Z0-9_]*$ ]] || die "имя переменной — заглавная латиница, цифры и _: $key"
  if [[ $val == *'$'* || $val == *$'\n'* ]]; then
    die "в значении $key есть «\$» или перенос строки — впишите его вручную в $ENV_FILE"
  fi
  if [[ $val == *'"'* ]]; then
    [[ $val != *"'"* ]] || die "в значении $key есть и одинарные, и двойные кавычки — впишите вручную в $ENV_FILE"
    q="'"
  fi
  tmp=$(mktemp "$SHARED/.env.XXXXXX")
  grep -vE "^$key=" "$ENV_FILE" > "$tmp" || true
  if [ -n "$val" ]; then printf '%s=%s%s%s\n' "$key" "$q" "$val" "$q" >> "$tmp"; fi
  chmod 600 "$tmp"
  chown --reference="$ENV_FILE" "$tmp"
  mv -f "$tmp" "$ENV_FILE"
}

site_host() {
  local url
  url=$(env_get NEXT_PUBLIC_SITE_URL)
  url=${url#*://}
  printf '%s' "${url%%/*}"
}

public_ip() {
  curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}'
}

notify() {
  local token chat
  token=$(env_get TELEGRAM_BOT_TOKEN)
  chat=$(env_get TELEGRAM_LEADS_CHAT_ID)
  if [ -z "$token" ] || [ -z "$chat" ]; then return 0; fi
  curl -fsS --max-time 10 -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
    --data-urlencode "chat_id=$chat" --data-urlencode "text=$1" || true
}

# --- Версии сайта ---------------------------------------------------------------

current_rev() { cat "$CURRENT/REVISION" 2>/dev/null || true; }

releases_newest_first() { find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort -r; }

# В bash -c '…' _ АРГУМЕНТЫ кавычки одинарные намеренно: $1, $2 раскрываются внутри.
# shellcheck disable=SC2016
build() {
  local sha=$1 rel=$2
  as_app mkdir -p "$rel" &&
    as_app bash -c 'git -C "$1" archive "$2" | tar -x -C "$3"' _ "$REPO" "$sha" "$rel" &&
    as_app bash -c 'printf "%s\n" "$1" > "$2/REVISION" && ln -s "$3" "$2/.env"' _ "$sha" "$rel" "$ENV_FILE" &&
    as_app bash -c 'cd "$1" && npm ci --include=dev --no-audit --no-fund --loglevel=error' _ "$rel" &&
    # Схема базы — до сборки, как на Vercel: без --accept-data-loss prisma откажется
    # от изменений, теряющих данные, и сборка остановится.
    as_app bash -c 'cd "$1" && npx prisma db push --skip-generate' _ "$rel" &&
    as_app bash -c 'cd "$1" && NEXT_TELEMETRY_DISABLED=1 npx next build' _ "$rel"
}

switch_to() {
  ln -sfn "$1" "$CURRENT.new"
  mv -Tf "$CURRENT.new" "$CURRENT"
  # 9>&- — блокировка обновлений не должна достаться запущенному сайту.
  $SYSTEMCTL restart tarify 9>&- || true
}

build_id() { cat "$1/.next/BUILD_ID" 2> /dev/null || true; }

# Главная отвечает, и это нужная сборка: её BUILD_ID есть в странице. Иначе ответ
# прежнего процесса, если он почему-то не остановился, сошёл бы за успех.
healthy() {
  local id=$1 _ page
  for _ in $(seq 1 60); do
    if page=$(curl -fs --max-time 5 "http://127.0.0.1:$PORT/") && [[ $page == *"$id"* ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

failed() {
  local sha=$1 step=$2
  printf '%s\n' "$sha" > "$SHARED/failed-rev"
  say "Не получилось на шаге «$step» — работает прежняя версия. Подробности выше и в tarify logs."
  notify "Сайт не обновился до версии ${sha:0:7}: ошибка на шаге «$step». Работает прежняя версия. На сервере: tarify logs"
}

prune() {
  local cur d n=0
  cur=$(readlink -f "$CURRENT")
  while IFS= read -r d; do
    n=$((n + 1))
    if [ "$n" -gt "$KEEP_RELEASES" ] && [ "$d" != "$cur" ]; then rm -rf "$d"; fi
  done < <(releases_newest_first)
}

deploy() {
  local sha=$1 rel prev
  rel="$RELEASES/$(date +%Y%m%d-%H%M%S)-${sha:0:7}"
  prev=$(readlink -f "$CURRENT" 2>/dev/null || true)
  say "Собираю версию ${sha:0:7}…"
  if ! build "$sha" "$rel"; then
    rm -rf "$rel"
    failed "$sha" "сборка"
    return 1
  fi
  switch_to "$rel"
  if ! healthy "$(build_id "$rel")"; then
    if [ -n "$prev" ] && [ -d "$prev" ]; then
      switch_to "$prev"
      healthy "$(build_id "$prev")" || warn "и прежняя версия не отвечает — смотрите tarify logs"
    fi
    rm -rf "$rel"
    failed "$sha" "запуск"
    return 1
  fi
  rm -f "$SHARED/failed-rev"
  prune
  say "Готово: работает версия ${sha:0:7}."
}

cmd_update() {
  local force=${1:-} sha
  exec 9> "$LOCK"
  if [ "$force" = --force ]; then
    flock -w 1800 9 || die "не дождался окончания другого обновления"
  else
    flock -n 9 || { say "Обновление уже идёт."; return 0; }
  fi
  as_app git -C "$REPO" fetch --quiet origin "$BRANCH" ||
    die "не удалось получить код из GitHub — проверьте ключ доступа: tarify status"
  sha=$(as_app git -C "$REPO" rev-parse "origin/$BRANCH")
  if [ "$force" != --force ]; then
    if [ "$sha" = "$(current_rev)" ]; then
      say "Уже последняя версия: ${sha:0:7}."
      return 0
    fi
    if [ "$sha" = "$(cat "$SHARED/failed-rev" 2>/dev/null || true)" ]; then
      say "Версия ${sha:0:7} не включена (не собралась или откачена) — жду следующего коммита или tarify update --force."
      return 0
    fi
  fi
  deploy "$sha"
}

cmd_rollback() {
  local cur prev rev
  exec 9> "$LOCK"
  flock -w 1800 9 || die "идёт обновление — повторите позже"
  cur=$(readlink -f "$CURRENT")
  prev=$(releases_newest_first | awk -v c="$cur" 'seen { print; exit } $0 == c { seen = 1 }')
  [ -n "$prev" ] || die "более ранней версии нет"
  rev=$(current_rev)
  switch_to "$prev"
  healthy "$(build_id "$prev")" || die "предыдущая версия не отвечает — смотрите tarify logs"
  # Чтобы таймер сразу не вернул откаченную версию: ждём следующего коммита.
  printf '%s\n' "$rev" > "$SHARED/failed-rev"
  say "Вернул версию $(basename "$prev"). Следующий коммит в GitHub подтянется как обычно."
}

# --- Команды ----------------------------------------------------------------------

cmd_env() {
  [ -f "$ENV_FILE" ] || die "нет $ENV_FILE — сначала deploy/install.sh"
  if [ $# -eq 0 ]; then
    say "Заданы (значение одной: tarify env КЛЮЧ):"
    grep -oE '^[A-Z][A-Z0-9_]*' "$ENV_FILE" | sed 's/^/  /'
    return 0
  fi
  if [ "$1" = --paste ]; then
    local line key val n=0
    say "Вставьте строки вида КЛЮЧ=значение, в конце — пустая строка."
    say "Подключение к базе не меняется: у сайта на этом сервере своя база."
    while IFS= read -r line && [ -n "${line%$'\r'}" ]; do
      line=${line%$'\r'}
      [[ ! $line =~ ^[[:space:]]*# ]] || continue
      if [[ ! $line =~ ^[[:space:]]*(export[[:space:]]+)?([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
        warn "пропускаю строку: $line"
        continue
      fi
      key=${BASH_REMATCH[2]}
      val=${BASH_REMATCH[3]}
      case $val in \"*\" | \'*\') val=${val:1:${#val}-2} ;; esac
      case $key in DATABASE_URL | DIRECT_URL | VERCEL*) continue ;; esac
      env_set "$key" "$val"
      n=$((n + 1))
    done
    if [ "$n" -eq 0 ]; then say "Ничего не задано."; return 0; fi
    say "Задано переменных: $n. Пересобираю сайт (5–10 минут)…"
    cmd_update --force
    return
  fi
  if [ $# -eq 1 ]; then
    env_get "$1"
    printf '\n'
    return 0
  fi
  [ $(($# % 2)) -eq 0 ] || die "нужны пары: tarify env КЛЮЧ ЗНАЧЕНИЕ [КЛЮЧ ЗНАЧЕНИЕ …]"
  while [ $# -gt 0 ]; do
    env_set "$1" "$2"
    shift 2
  done
  say "Пересобираю сайт, чтобы применить (5–10 минут)…"
  cmd_update --force
}

cmd_https() {
  local host dns ip
  host=$(site_host)
  [ -n "$host" ] || die "в $ENV_FILE нет NEXT_PUBLIC_SITE_URL"
  dns=$(getent ahostsv4 "$host" | awk 'NR == 1 {print $1}' || true)
  ip=$(public_ip)
  if [ "$dns" != "$ip" ]; then
    if [ -n "$dns" ]; then
      say "Домен $host пока указывает на $dns, а адрес этого сервера — $ip."
    else
      say "Домен $host пока ни на что не указывает, а адрес этого сервера — $ip."
    fi
    say "Поменяйте A-запись домена на $ip и через 10–30 минут выполните: tarify https"
    return 1
  fi
  certbot --nginx -d "$host" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  say "HTTPS включён: https://$host — сертификат будет продлеваться сам."
}

cmd_backup() {
  local url f
  url=$(env_get DATABASE_URL)
  [ -n "$url" ] || die "в $ENV_FILE нет DATABASE_URL"
  install -d -m 700 "$BACKUPS"
  f="$BACKUPS/tarify-$(date +%Y-%m-%d-%H%M%S).dump"
  pg_dump --format=custom --no-owner --dbname="$url" --file="$f.part"
  mv "$f.part" "$f"
  chmod 600 "$f"
  find "$BACKUPS" -maxdepth 1 -type f -name 'tarify-*.dump' | sort -r |
    tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
  say "Копия базы: $f ($(du -h "$f" | cut -f1))"
}

cmd_import_db() {
  local src=${1:-} yes=${2:-} dst dump answer
  [ -n "$src" ] || die "укажите строку подключения или файл копии: tarify import-db 'postgresql://…'"
  dst=$(env_get DATABASE_URL)
  [ -n "$dst" ] || die "в $ENV_FILE нет DATABASE_URL"
  if [ ! -f "$src" ]; then
    # Neon: pg_dump работает только с прямым подключением, не через пулер.
    src=${src/-pooler./.}
    [ "$src" != "$dst" ] || die "это строка подключения к базе самого сервера"
  fi
  if [ "$yes" != --yes ]; then
    read -rp "Данные сайта на этом сервере заменятся копией. Введите «да», чтобы продолжить: " answer
    [ "$answer" = да ] || die "отменено"
  fi
  dump=$(mktemp)
  if [ -f "$src" ]; then
    # Копируем сразу: копия текущей базы ниже не должна затереть восстанавливаемый файл.
    cp "$src" "$dump"
  else
    say "Скачиваю копию базы…"
    if ! pg_dump --format=custom --no-owner --no-acl --dbname="$src" --file="$dump"; then
      rm -f "$dump"
      die "не удалось скачать базу — проверьте строку подключения"
    fi
  fi
  if cmd_backup > /dev/null; then say "Прежняя база сохранена в $BACKUPS."; fi
  $SYSTEMCTL stop tarify || true
  say "Загружаю…"
  PGOPTIONS='-c client_min_messages=warning' psql --quiet --dbname="$dst" -v ON_ERROR_STOP=1 \
    -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'
  pg_restore --no-owner --no-acl --dbname="$dst" "$dump" || warn "pg_restore сообщил об ошибках — проверьте данные на сайте"
  rm -f "$dump"
  if [ -d "$CURRENT" ]; then
    # shellcheck disable=SC2016
    as_app bash -c 'cd "$1" && npx prisma db push --skip-generate > /dev/null' _ "$CURRENT" ||
      warn "схема базы не обновилась — выполните tarify update --force"
  fi
  $SYSTEMCTL start tarify 9>&- || true
  say "Готово. В базе тарифов: $(psql --dbname="$dst" -tA -c 'SELECT count(*) FROM "Plan"'), заявок: $(psql --dbname="$dst" -tA -c 'SELECT count(*) FROM "Lead"')."
}

cmd_status() {
  local rev sha failed_rev last
  rev=$(current_rev)
  if timeout 30 "${AS_APP[@]}" git -C "$REPO" fetch --quiet origin "$BRANCH" 2> /dev/null; then
    sha=$(as_app git -C "$REPO" rev-parse "origin/$BRANCH")
  else
    sha=""
    say "Нет доступа к GitHub. Ключ сервера (Settings → Deploy keys):"
    cat "$BASE/.ssh/deploy_key.pub" 2> /dev/null || true
  fi
  say "Сайт:             $(env_get NEXT_PUBLIC_SITE_URL)"
  if [ -z "$rev" ]; then
    say "Версия:           ещё не собрана"
  elif [ "$rev" = "$sha" ]; then
    say "Версия:           ${rev:0:7} — последняя из GitHub"
  else
    say "Версия:           ${rev:0:7}${sha:+, в GitHub уже ${sha:0:7}}"
  fi
  failed_rev=$(cat "$SHARED/failed-rev" 2> /dev/null || true)
  if [ -n "$failed_rev" ]; then say "Не включена:      ${failed_rev:0:7} (tarify update --force — попробовать снова)"; fi
  say "Сайт работает:    $($SYSTEMCTL is-active tarify 2> /dev/null || true)"
  say "Автообновление:   $($SYSTEMCTL is-active tarify-update.timer 2> /dev/null || true)"
  last=$(find "$BACKUPS" -maxdepth 1 -name 'tarify-*.dump' 2> /dev/null | sort | tail -n 1 || true)
  say "Копия базы:       ${last:-ещё нет}"
  say "Свободно на диске: $(df -h "$BASE" | awk 'NR == 2 {print $4}')"
}

cmd_logs() {
  if [ "${1:-}" = -f ]; then
    exec journalctl -u tarify -u tarify-update -f
  fi
  journalctl -u tarify -u tarify-update -n 200 --no-pager
}

main() {
  [ "$(id -u)" -eq 0 ] || die "запустите от root: sudo tarify ${*:-}"
  local cmd=${1:-help}
  shift || true
  case $cmd in
    status) cmd_status ;;
    update) cmd_update "${1:-}" ;;
    rollback) cmd_rollback ;;
    env) cmd_env "$@" ;;
    https) cmd_https ;;
    backup) cmd_backup ;;
    import-db) cmd_import_db "$@" ;;
    logs) cmd_logs "${1:-}" ;;
    *) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed -e '$d' -e 's/^# \{0,1\}//' ;;
  esac
}

# Установщик подключает этот файл ради функций — тогда команды не запускаются.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
