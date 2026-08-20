#!/usr/bin/env bash
# ============================================================
#  Team Truth — Production deployment script
#  Run manually on the server: bash scripts/deploy.sh
# ============================================================
set -euo pipefail

APP_DIR="$HOME/planning.trukumbholdings.co.zw"
PHP="php"
COMPOSER="composer"

print_step() { echo -e "\n\033[1;33m▶ $1\033[0m"; }
print_ok()   { echo -e "\033[1;32m✓ $1\033[0m"; }

print_step "Entering application directory..."
cd "$APP_DIR"

print_step "Putting application into maintenance mode..."
$PHP artisan down --retry=15 || true

print_step "Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

print_step "Installing PHP dependencies..."
$COMPOSER install --no-dev --optimize-autoloader --no-interaction --prefer-dist

print_step "Running database migrations..."
$PHP artisan migrate --force

print_step "Caching configuration, routes and views..."
$PHP artisan config:cache
$PHP artisan route:cache
$PHP artisan view:cache
$PHP artisan event:cache

print_step "Restarting queue workers..."
$PHP artisan queue:restart || true

print_step "Creating storage symlink (if needed)..."
$PHP artisan storage:link --force 2>/dev/null || true

print_step "Setting file permissions..."
find storage -type d -exec chmod 775 {} \;
find storage -type f -exec chmod 664 {} \;
find bootstrap/cache -type f -exec chmod 664 {} \;

print_step "Taking application out of maintenance mode..."
$PHP artisan up

print_ok "Deployment complete — $(date)"
