FROM mhart/alpine-node:9.1.0

# create limited user account for UNMS
RUN mkdir /home/app

ENV HOME=/home/app \
    PATH=/home/app/unms/node_modules/.bin:$PATH \
    HTTP_PORT=8081 \
    WS_PORT=8082 \
    UNMS_RABBITMQ_HOST=unms-rabbitmq \
    UNMS_RABBITMQ_PORT=5672 \
    UNMS_REDISDB_HOST=unms-redis \
    UNMS_REDISDB_PORT=6379 \
    UNMS_PG_HOST=unms-postgres \
    UNMS_PG_PORT=5432 \
    UNMS_FLUENTD_HOST=unms-fluentd \
    UNMS_FLUENTD_PORT=24224 \
    UNMS_NGINX_HOST=unms-nginx \
    UNMS_NGINX_PORT=12345 \
    NODE_ENV=production

WORKDIR $HOME/unms
COPY . $HOME/unms/

COPY repositories /etc/apk/repositories
RUN devDeps="vips-dev fftw-dev make python g++" \
    && apk upgrade --update \
    && apk add ${devDeps} su-exec redis gzip bash vim dumb-init openssl postgresql vips libcap \
    && npm install \
    && apk del ${devDeps} \
    && mkdir -p -m 777 "$HOME/unms/public/site-images" \
    && mkdir -p -m 777 "$HOME/unms/data/config-backups" \
    && mkdir -p -m 777 "$HOME/unms/data/unms-backups" \
    && mkdir -p -m 777 "$HOME/unms/data/import" \
    && mv "$HOME/unms/docker-entrypoint.sh" "/usr/local/bin/" \
    && chmod +x "/usr/local/bin/docker-entrypoint.sh"

RUN setcap cap_net_raw=pe /usr/bin/node

ENTRYPOINT ["/usr/bin/dumb-init", "docker-entrypoint.sh"]

CMD ["npm start"]
