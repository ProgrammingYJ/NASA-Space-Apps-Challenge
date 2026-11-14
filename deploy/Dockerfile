FROM node:22.17.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production APP_STATE_DIR=/app/var PORT=8000
COPY package.json package-lock.json app.js ./
COPY node/ node/
COPY contracts/ contracts/
COPY web/dist/ web/dist/
COPY web/public/ web/public/
COPY web/src/objectNames.ts web/src/objectNames.ts
COPY data/manifests/ data/manifests/
COPY THIRD_PARTY_NOTICES.md ./
EXPOSE 8000
# The complete data directory and persistent state are mounted by compose.
# Built-in Node modules only: no Python or runtime npm dependency is needed.
CMD ["node", "app.js"]
