#!/usr/bin/env bash
# OPS-01: build image API → chạy trong compose (Linux) → k6 cùng network → kiểm bất biến.
# Biến: VUS, BUYERS_PER_VU, SEATS, ADMIT_RATE (người/giây được cho vào), DB_POOL_MAX.
set -euo pipefail
cd "$(dirname "$0")/.."
docker build -q -f apps/api/Dockerfile -t seatrush-api:local . >/dev/null
docker compose --profile loadtest up -d --wait --force-recreate api >/dev/null
out="loadtest/results/$(date +%Y%m%d-%H%M%S)-admit${ADMIT_RATE:-200}"
mkdir -p "$out"
{ echo "machine: $(sysctl -n hw.model 2>/dev/null || uname -m), $(sysctl -n hw.ncpu 2>/dev/null || nproc) CPU host"
  echo "docker: $(docker info --format '{{.NCPU}} CPU, {{.MemTotal}} bytes' )"
  echo "api: 1 container, DB_POOL_MAX=${DB_POOL_MAX:-30}, ADMIT_RATE=${ADMIT_RATE:-200}/s; postgres 17 + redis 7 in docker"
  echo "load: VUS=${VUS:-1000} x ${BUYERS_PER_VU:-3} buyers, SEATS=${SEATS:-2000}"; } > "$out/env.txt"

net=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$(docker compose ps -q api)")
docker run --rm -i --network "$net" -v "$PWD/loadtest:/scripts" -e API=http://api:4000 \
  -e VUS="${VUS:-1000}" -e BUYERS_PER_VU="${BUYERS_PER_VU:-3}" -e SEATS="${SEATS:-2000}" \
  grafana/k6:latest run --quiet --summary-export=/scripts/results/summary.json /scripts/rush.js | tee "$out/k6.txt" || true
mv loadtest/results/summary.json "$out/" 2>/dev/null || true
sleep 3 # relay + notifier xử lý nốt outbox
docker compose logs api --no-log-prefix > "$out/api.log" 2>&1
pnpm -s verify | tee "$out/verify.txt"
docker compose --profile loadtest stop api >/dev/null
echo "kết quả: $out"
