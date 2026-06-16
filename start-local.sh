#!/usr/bin/env bash
# Local validation launcher for the redesigned workflow (untracked, dev-only).
# DB: throwaway docker mongo "wavemax-local" on 27018 — NEVER localhost:27017
# (that is a tunnel to what is plausibly the production ADB).
#
#   ./start-local.sh           start (docker db + server on :3001)
#   ./start-local.sh stop      stop server + db container
#   ./start-local.sh logs      tail the server log
#   ./start-local.sh reset     wipe the local DB and re-seed admin/config
set -euo pipefail
cd "$(dirname "$0")"

export MONGODB_URI='mongodb://localhost:27018/wavemax_local'
export MONGODB_TLS=false
export NODE_ENV=development
export PORT=3001
export BASE_URL='http://localhost:3001'
export FRONTEND_URL='http://localhost:3001'
export RUN_BACKGROUND_JOBS=false   # flip to true to watch the 60-min payment reminder cron
export W9_STORAGE_PATH="$HOME/wavemax-local-w9"
LOG=/tmp/wavemax-local.log
PIDFILE=/tmp/wavemax-local.pid

stop_server() {
  if [[ -f $PIDFILE ]] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
    kill "$(cat $PIDFILE)" && echo "server stopped (pid $(cat $PIDFILE))"
  fi
  rm -f $PIDFILE
}

case "${1:-start}" in
  stop)
    stop_server
    docker stop wavemax-local >/dev/null 2>&1 && echo "db container stopped" || true
    ;;
  logs)
    tail -f $LOG
    ;;
  reset)
    stop_server
    docker exec wavemax-local mongosh --quiet --eval 'db.getSiblingDB("wavemax_local").dropDatabase()'
    echo "local db wiped — run ./start-local.sh to re-seed and relaunch"
    ;;
  start)
    docker start wavemax-local >/dev/null 2>&1 || \
      docker run -d --name wavemax-local -p 27018:27017 mongo:7 >/dev/null
    sleep 2
    mkdir -p "$W9_STORAGE_PATH" && chmod 700 "$W9_STORAGE_PATH"
    # scripts/setup/init-defaults.js hardcodes tls:true — seed config directly
    node -e "
      require('dotenv').config();
      const m = require('mongoose');
      m.connect(process.env.MONGODB_URI).then(async () => {
        await require('./server/models/SystemConfig').initializeDefaults();
        console.log('SystemConfig defaults seeded');
        process.exit(0);
      }).catch(e => { console.error(e.message); process.exit(1); });
    "
    node scripts/admin/create-admin-quick.js || true
    node scripts/ensure-indexes.js
    stop_server
    nohup node server.js > $LOG 2>&1 &
    echo $! > $PIDFILE
    # cold start off /mnt/c can take 60s+
    up=""
    for i in $(seq 1 18); do
      sleep 5
      curl -sf "http://localhost:3001/health" >/dev/null && { up=1; break; }
    done
    if [[ -n $up ]]; then
      echo ""
      echo "✅ WaveMAX local validation environment is UP"
      echo "   Admin login:   http://localhost:3001/embed-app-v2.html?route=/administrator-login"
      echo "   Email:         admin@wavemax.promo   Password: WaveMAX!2024"
      echo "   Health:        http://localhost:3001/api/health"
      echo "   Log:           tail -f $LOG"
    else
      echo "❌ health check failed — last 30 log lines:"; tail -30 $LOG; exit 1
    fi
    ;;
esac
