# Multi-stage Dockerfile for a NextRush app using @nextrush/adapter-node.
#
# NOTE ON THE `vendor/` DIRECTORY: this example installs NextRush from local
# tarballs in ./vendor instead of the public npm registry. That is a
# verification-only detail — the workspace this doc was built from is on an
# unreleased 3.1.0 line, and pinning to whatever version is actually
# installable (`npm install nextrush`) is what a real project does. Delete
# the `COPY vendor/` line and the `npm install ./vendor/*.tgz` step, and
# install `nextrush` from the registry instead once you're outside this
# verification harness.

# ---- Build stage -----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY vendor/ ./vendor/

# Installs from local tarballs (verification-only, see note above) rather
# than the registry. `--omit=dev` keeps the installed tree production-only.
RUN npm install ./vendor/*.tgz --omit=dev

COPY src/ ./src/

# ---- Runtime stage ----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Run as a non-root user — the node:22-alpine base image already ships a
# `node` user/group (uid/gid 1000), so no need to create one.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/src ./src

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
