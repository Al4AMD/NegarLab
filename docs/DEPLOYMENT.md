# Deployment

## Docker Compose

```sh
cp .env.example .env   # optional overrides
docker compose up -d --build
```

- Web: `http://localhost:8080` — Caddy serves the SPA and proxies `/api/*` to `api:8000` (SSE-safe, `flush_interval -1`).
- API: reachable only inside the compose network; healthcheck at `/api/v1/health`.
- Storage: named volume `negarlab-data` mounted at `/data`; TTL sweeper deletes expired images automatically.
- API container runs as UID 1000, non-root.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `NEGARLAB_HTTP_PORT` | `8080` | Host port for the web container |
| `NEGARLAB_TTL_MINUTES` | `60` | Image lifetime |
| `NEGARLAB_UPLOAD_MAX_BYTES` | `26214400` (25 MiB) | Upload limit |
| `NEGARLAB_JOB_STEP_DELAY_MS` | `50` | Demo job pacing |

## Notes

- The job registry and image index are in-process. This deployment is single-instance by design; scaling out requires shared storage and a shared job store (not in W0).
- Demo and test images are synthetic; no external asset service is required.
- No ML models are included yet (W6). Model downloads will use a separate volume and prefetch script.
- For a public host, terminate TLS in front of the web service or add a Caddy site address and certificate automation.
