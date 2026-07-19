# Imagen única: la API sirve también el front ya compilado, así todo va por
# el MISMO origen y la cookie SameSite=Strict sigue funcionando sin CORS.

# ---------- 1. Compilar ----------
FROM node:24-alpine AS build
WORKDIR /app

# El .npmrc del proyecto trae ignore-scripts=true (política de seguridad de
# dependencias). Por eso hay que reconstruir a mano los binarios nativos que
# la compilación necesita, igual que hace el CI.
COPY package.json package-lock.json .npmrc ./
RUN npm ci
RUN npm rebuild esbuild nx unrs-resolver

COPY . .
RUN npx nx build api --configuration=production \
 && npx nx build pathfinder-app --configuration=production

# Deja node_modules solo con las dependencias de producción, en las
# versiones EXACTAS del lockfile del repositorio.
#
# OJO: no se usa el package.json/lockfile podado que genera Nx en
# dist/apps/api. Ese lockfile sale INCOMPLETO (le falta alguna dependencia
# transitiva, p. ej. content-type de express) y `npm ci` lo rechaza. Podar
# el árbol completo es más pesado pero reproducible, que es lo que importa.
RUN npm prune --omit=dev

# ---------- 2. Ejecutar ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# El bundle de la API (webpack deja las dependencias fuera, por eso hacen
# falta los node_modules de arriba) y, a su lado, el front compilado: la
# ruta coincide con la que busca main.ts (../pathfinder-app/browser).
COPY --from=build /app/dist/apps/api/main.js ./apps/api/main.js
COPY --from=build /app/dist/apps/pathfinder-app/browser ./apps/pathfinder-app/browser

# Las migraciones se ejecutan aparte, ANTES de arrancar (ver README): así un
# fallo de esquema no deja el contenedor reiniciándose en bucle.
EXPOSE 3000
CMD ["node", "apps/api/main.js"]
