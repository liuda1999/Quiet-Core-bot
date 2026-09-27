FROM node:24-bookworm-slim@sha256:242549cd46785b480c832479a730f4f2a20865d61ea2e404fdb2a5c3d3b73ecf

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git python3 \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /workspace/quiet-core-bot
COPY . .

RUN QUIET_CORE_DISABLE_BUNDLED_PLUGIN_POSTINSTALL=1 pnpm install --frozen-lockfile --ignore-scripts --filter quiet-core-bot

CMD ["bash"]
