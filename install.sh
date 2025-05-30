#!/usr/bin/env bash
set -e
apt update
apt install -y curl sqlite3 build-essential nodejs npm
cd /opt/$APP_NAME
npm ci
npm run build
npm run migrate
echo "$APP_NAME installed at /opt/$APP_NAME – edit .env as needed"

