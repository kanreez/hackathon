# One image for Kuso: the Express backend, which also serves the web build from dist/.
#   kuso env set <project> <service> EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=...
# reach this build as build args (they're public and end up in the browser bundle anyway).
# The server's secrets (SUPABASE_SERVICE_ROLE_KEY, AI keys) are runtime env only.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    NODE_ENV=production
RUN npx expo export --platform web --output-dir dist
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
EXPOSE 3000
USER node
CMD ["node", "server/server.js"]
