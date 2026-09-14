# TLS certificates

`nginx.conf` expects two files in this directory:

- `fullchain.pem`
- `privkey.pem`

They are intentionally **not** in the repository. Provide them one of two ways:

- **Let's Encrypt** — run certbot on the host and bind-mount
  `/etc/letsencrypt/live/<domain>/` into `infra/nginx/certs`.
- **Local development** — generate a self-signed pair:

  ```bash
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout infra/nginx/certs/privkey.pem \
    -out infra/nginx/certs/fullchain.pem \
    -subj "/CN=localhost"
  ```

The proxy is optional: `docker compose ... --profile proxy up` enables it.
