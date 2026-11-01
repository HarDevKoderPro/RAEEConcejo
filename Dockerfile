# Inventario RAEE · imagen de producción
# better-sqlite3 trae binarios precompilados para Linux x64 (glibc), por eso se usa bookworm-slim.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3100 \
    DB_PATH=/app/data/raee.db \
    FOTOS_DIR=/app/data/fotos \
    TZ=America/Bogota

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY db ./db
COPY src ./src
COPY public ./public
COPY scripts ./scripts

ARG GIT_COMMIT=dev
ENV GIT_COMMIT=$GIT_COMMIT

# La carpeta de datos se monta como volumen; se crea aquí para que el volumen herede el dueño.
RUN mkdir -p /app/data/fotos && chown -R node:node /app/data
USER node

EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Primera vez: crea la base con los datos de demostración. Después solo arranca.
CMD ["sh", "-c", "[ -f \"$DB_PATH\" ] || node scripts/db-init.js --seed; exec node src/server.js"]
