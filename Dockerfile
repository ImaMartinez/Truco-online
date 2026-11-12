# Node 24 LTS; builds only the backend workspace, never the local .env files.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --include=dev --ignore-scripts
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src
COPY shared shared
RUN npm run build --workspace backend
RUN npm prune --workspace backend --include-workspace-root=false --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production ARENA_STORAGE=supabase BIND_HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/certs backend/certs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=8s --start-period=30s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{signal:AbortSignal.timeout(6000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node","backend/dist/backend/src/server.js"]
