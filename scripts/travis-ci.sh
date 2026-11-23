#!/usr/bin/env bash

set -euo pipefail

task="${TRAVIS_CI_TASK:-}"
if [[ -z "$task" && "${TRAVIS_EVENT_TYPE:-}" == "cron" ]]; then
  task="daily"
fi

run_ci() {
  npm test
  npm run lint
  npm run build
}

run_daily() {
  local app_url="${APP_URL:-http://127.0.0.1:3000}"
  local backfill_days="${BACKFILL_DAYS:-1}"
  local start_date="${BACKFILL_START_DATE:-}"

  if ! [[ "$backfill_days" =~ ^[0-9]+$ ]] || ((backfill_days < 1 || backfill_days > 30)); then
    echo "BACKFILL_DAYS must be between 1 and 30"
    exit 1
  fi

  start_date="${start_date#start_date=}"
  if [[ -z "$start_date" && "${TRAVIS_EVENT_TYPE:-}" == "cron" ]]; then
    start_date="$(date -u -d yesterday +%F)"
  fi
  start_date="${start_date:-$(date -u +%F)}"
  if ! [[ "$start_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] ||
    ! date -u -d "$start_date" +%F >/dev/null 2>&1; then
    echo "BACKFILL_START_DATE must use YYYY-MM-DD"
    exit 1
  fi

  : "${PH_API_TOKEN:?PH_API_TOKEN is required}"
  : "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
  : "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
  : "${SYNC_SECRET:?SYNC_SECRET is required}"

  npm run build
  npm run start -- --hostname 127.0.0.1 --port 3000 > .travis-ci.log 2>&1 &

  for _ in $(seq 1 60); do
    if curl -fsS "$app_url" >/dev/null; then
      break
    fi
    sleep 2
  done

  if ! curl -fsS "$app_url" >/dev/null; then
    cat .travis-ci.log
    exit 1
  fi

  for ((offset = 0; offset < backfill_days; offset += 1)); do
    launch_date="$(date -u -d "$start_date - $offset days" +%F)"
    echo "Importing Product Hunt launches for $launch_date"
    curl --fail-with-body -sS -X POST "$app_url/api/fetch-products" \
      -H "Authorization: Bearer $SYNC_SECRET" \
      -H "Content-Type: application/json" \
      --data "{\"date\":\"$launch_date\"}"

    echo "Generating WebP screenshots for $launch_date"
    npm run screenshot -- --all --date "$launch_date" --refresh-after-days 30
  done

  curl --fail-with-body -sS "$app_url/api/health"
}

run_cleanup() {
  if [[ "${APPLY_ORPHANS:-false}" == "true" ]]; then
    npm run screenshots:cleanup -- --apply
  else
    npm run screenshots:cleanup
  fi
}

run_recapture() {
  : "${TARGET_SLUG:?TARGET_SLUG is required}"
  if ! [[ "$TARGET_SLUG" =~ ^[a-z0-9-]+$ ]]; then
    echo "TARGET_SLUG must contain only lowercase letters, numbers, and hyphens"
    exit 1
  fi
  npm run screenshot -- --slug "$TARGET_SLUG" --refresh-after-days 30
}

case "$task" in
  ""|"ci")
    run_ci
    ;;
  "daily")
    run_daily
    ;;
  "cleanup")
    run_cleanup
    ;;
  "recapture")
    run_recapture
    ;;
  *)
    echo "Unknown TRAVIS_CI_TASK: $task"
    exit 1
    ;;
esac
