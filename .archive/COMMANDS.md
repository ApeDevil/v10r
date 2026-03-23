# claude
claude --chrome

cd dev/velociraptor/

#
podman-compose up
podman-compose up -d
podman logs -f v10r
podman restart v10r

# stop
psv(podman stop v10r)
podman-compose down

# --------------------------build
podman compose build

# ----------------- Kill
lsof -i :5173
kill 
podman rm -f v10r

# ---------------------------------- Test
podman exec -it v10r bun run check
podman exec -it v10r bun run lint
podman exec -it v10r bun run test

1. bun run check — TypeScript compilation
2. bun run lint — Biome linting
3. bun run test — Full test suite


# shows only running containers
podman ps
# shows all containers (running + stopped)
podman ps -a 


# ------------------------------------ DB
podman exec v10r bun run db:generate
podman exec v10r bun run db:migrate
podman exec v10r bun run db:push
## migrations (schema push)
podman exec -it v10r bun run drizzle-kit push
### neon rag
podman exec -it v10r bun run db:rag-pre
podman exec -it v10r bun run db:push
podman exec -it v10r bun run db:rag-post
### neo4j rag
podman exec -it v10r bun run db:neo4j-setup

de

podman machine info
podman version
podman ps

podman compose down && podman compose up --build -d


--- 

# Just starting/restarting
podman compose up -d

# After editing Containerfile.dev or compose.yaml
podman compose up --build -d


# Telegram
./scripts/tunnel-dev.sh 
cd ~/dev/velociraptor && ./scripts/tunnel-dev.sh 
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
-H "Content-Type: application/json" \
-d '{"url": "https://abc123.ngrok-free.app/api/telegram/webhook"}'