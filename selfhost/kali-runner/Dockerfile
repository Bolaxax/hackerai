# HackerAI Remote Control runner: an isolated Kali container on the server.
# It connects to the self-hosted backend like any other computer, but it has
# no Docker socket, no host mounts and no access to the Convex volume.
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl wget git jq unzip \
    python3 python3-pip python3-venv \
    nodejs npm \
    dnsutils iputils-ping netcat-openbsd openssh-client whois \
    nmap masscan sqlmap nikto gobuster ffuf whatweb hydra \
  && rm -rf /var/lib/apt/lists/*

# Pin the CLI to the version deployed with this commit (packages/local).
ARG HACKERAI_LOCAL_VERSION=0.8.9
RUN npm install -g "@hackerai/local@${HACKERAI_LOCAL_VERSION}" \
  && npm cache clean --force

WORKDIR /workspace

# The client exits after 1 hour without commands; the compose restart policy
# brings it back. The token comes from Coolify, never from the image.
CMD ["sh", "-c", "exec hackerai-local --token \"$HACKERAI_LOCAL_TOKEN\" --convex-url \"$HACKERAI_CONVEX_URL\" --name \"${HACKERAI_RUNNER_NAME:-Servidor Kali}\""]
