#!/bin/sh
# Inicia API e Worker no mesmo container (Railway free plan)
# API na porta $PORT, Worker em background

echo "Starting Fiscal Emitter API + Worker..."

# Inicia Worker em background
node dist/src/worker/worker-entry &
WORKER_PID=$!
echo "Worker started (PID $WORKER_PID)"

# Inicia API em foreground (mantém o container vivo)
node dist/src/main
API_EXIT=$?

# Se a API morrer, mata o worker também
kill $WORKER_PID 2>/dev/null
exit $API_EXIT
