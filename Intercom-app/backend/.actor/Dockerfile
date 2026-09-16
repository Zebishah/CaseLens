FROM apify/actor-node:24

WORKDIR /usr/src/app

COPY --chown=myuser:myuser package*.json ./
RUN npm install --include=dev

COPY --chown=myuser:myuser . .
RUN npm run build && npm prune --omit=dev

CMD ["node", "dist/actor/main.js"]
