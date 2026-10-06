#!/usr/bin/env bash
# بکاپ هفتگی گت‌استوک: دیتابیس PostgreSQL + فایل‌های storage + .env
# نگه‌داری: فقط ۲ بکاپ آخر. بکاپ‌های قدیمی‌تر فقط وقتی پاک می‌شوند که بکاپ جدید کامل ساخته و تست شده باشد؛
# بنابراین در هفته‌ی اول و دوم چیزی پاک نمی‌شود و حذف از بکاپ سوم شروع می‌شود.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/getstock-weekly}"
KEEP="${KEEP:-2}"
# اختیاری: کپی بیرون از سرور، مثلاً user@host:/backups/getstock/ (نیاز به کلید SSH بدون رمز)
RSYNC_TARGET="${BACKUP_RSYNC_TARGET:-}"

umask 077
mkdir -p "$BACKUP_ROOT"
exec 9>"$BACKUP_ROOT/.lock"
flock -n 9 || { echo "بکاپ دیگری در حال اجراست."; exit 1; }

# DATABASE_URL از .env خوانده می‌شود (بدون source کردن فایل)؛ پارامتر ?schema=... برای pg_dump معتبر نیست.
DB_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/?.*$//')"
[ -n "$DB_URL" ] || { echo "DATABASE_URL در .env پیدا نشد."; exit 1; }

STAMP="$(date +%Y-%m-%d_%H%M%S)"
TMP="$BACKUP_ROOT/.tmp-$STAMP"
FINAL="$BACKUP_ROOT/$STAMP"
trap 'rm -rf "$TMP"' ERR
mkdir -p "$TMP"

echo "۱) دیتابیس…"
pg_dump --format=custom --no-owner --dbname="$DB_URL" --file="$TMP/db.dump"
pg_restore --list "$TMP/db.dump" > /dev/null          # تست سالم‌بودن فایل

echo "۲) فایل‌ها و تنظیمات…"
tar -czf "$TMP/files.tgz" -C "$APP_DIR" --ignore-failed-read .env storage 2>/dev/null || tar -czf "$TMP/files.tgz" -C "$APP_DIR" .env
tar -tzf "$TMP/files.tgz" > /dev/null                   # تست سالم‌بودن آرشیو

( cd "$TMP" && sha256sum db.dump files.tgz > SHA256SUMS )
mv "$TMP" "$FINAL"                                      # فقط بکاپ کامل نام نهایی می‌گیرد
trap - ERR
echo "بکاپ ساخته شد: $FINAL ($(du -sh "$FINAL" | cut -f1))"

if [ -n "$RSYNC_TARGET" ]; then
  rsync -a --delete-after "$FINAL" "$RSYNC_TARGET" && echo "کپی بیرونی انجام شد."
fi

# حذف قدیمی‌ها: فقط پوشه‌های تاریخ‌دار کامل؛ KEEP تای آخر می‌مانند
mapfile -t ALL < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort)
COUNT="${#ALL[@]}"
if [ "$COUNT" -gt "$KEEP" ]; then
  for d in "${ALL[@]:0:$((COUNT-KEEP))}"; do echo "حذف بکاپ قدیمی: $d"; rm -rf "$d"; done
fi
echo "تعداد بکاپ‌های موجود: $(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' | wc -l)"
