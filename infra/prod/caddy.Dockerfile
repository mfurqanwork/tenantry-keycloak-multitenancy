# Caddy with the Cloudflare DNS module, for wildcard certificates (ADR-0029).
FROM caddy:2.10-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY infra/prod/Caddyfile /etc/caddy/Caddyfile
RUN chown -R 1000:1000 /data /config
USER 1000:1000
