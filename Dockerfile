FROM oven/bun:latest

RUN mkdir -p /home/bun/app/node_modules && chown -R bun:bun /home/bun/app

WORKDIR /home/bun/app

COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun bun.lockb ./
COPY --chown=bun:bun tsconfig.json ./
USER bun
RUN bun install

CMD ["bun", "run", "start"]