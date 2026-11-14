FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node probe.cjs ./probe.cjs
USER node
ENV NODE_ENV=production
ENTRYPOINT ["node","/app/probe.cjs"]
