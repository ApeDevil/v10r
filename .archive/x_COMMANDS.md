
cd dev/velociraptor/
# 
podman-compose up
podman-compose up -d
podman logs -f v10r


podman restart v10r

# stop
podman-compose down
podman-compose down && podman-compose up -d

# Kill
lsof -i :5173
kill XXXXX (rootlessp XXXXX)



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