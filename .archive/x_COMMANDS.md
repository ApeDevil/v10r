

podman-compose up -d
podman logs -f v10r

podman-compose down && podman-compose up -d

podman restart v10r

# stop
podman-compose down


# shows only running containers
podman ps
# shows all containers (running + stopped)
podman ps -a 




podman machine info
podman version
podman ps

podman compose down && podman compose up --build -d


--- 

# Just starting/restarting
podman compose up -d

# After editing Containerfile.dev or compose.yaml
podman compose up --build -d