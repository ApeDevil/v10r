# claude
claude --chrome

cd dev/velociraptor/

#
prv(podman run v10r)
podman-compose up
podman-compose up -d
podman logs -f v10r
podman restart v10r

# stop
psv(podman stop v10r)
podman-compose down
podman-compose down && podman-compose up -d

# build
podman compose build
podman compose down && podman compose build && podman compose up -d

# Kill
lsof -i :5173
kill XXXXX (rootlessp XXXXX)
podman rm -f v10r


# shows only running containers
podman ps
# shows all containers (running + stopped)
podman ps -a 


# DB neon
## migrations (schema push)
podman exec -it v10r bun run drizzle-kit push

podman exec -it v10r npx drizzle-kit push
podman exec -it v10r bun run drizzle-kit push


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