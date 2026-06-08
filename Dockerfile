FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY config ./config
COPY docs ./docs
COPY src ./src
COPY tests ./tests
COPY README.md ./

RUN mkdir -p /app/data

VOLUME ["/app/data"]

ENTRYPOINT ["node", "--experimental-strip-types", "src/cli.ts"]
CMD ["run"]
