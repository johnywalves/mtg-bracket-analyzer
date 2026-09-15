FROM node:22-alpine AS build

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web ./
# lib/rules/game-changers.ts lê backend/mtg_analyzer/rules/commander/*.yaml via
# process.cwd()/../backend/... — precisa estar presente tanto no build (páginas
# estáticas) quanto no runtime (a "/" é dinâmica e chama getGameChangerNames()
# a cada request).
COPY backend/mtg_analyzer/rules/commander /app/backend/mtg_analyzer/rules/commander

RUN npm run build

FROM node:22-alpine AS run

WORKDIR /app/web
ENV NODE_ENV=production

COPY --from=build /app/web/package.json /app/web/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/web/.next ./.next
COPY --from=build /app/web/public ./public
COPY --from=build /app/web/next.config.ts ./next.config.ts
COPY --from=build /app/backend/mtg_analyzer/rules/commander /app/backend/mtg_analyzer/rules/commander

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
