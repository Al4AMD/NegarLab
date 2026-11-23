# Third-party

Record direct dependencies and their licenses. Verify before adding; update this file in the same commit.

## Frontend

| Package | License | Use |
|---|---|---|
| react, react-dom | MIT | UI |
| zustand | MIT | State |
| i18next, react-i18next | MIT | Bilingual UI |
| comlink | Apache-2.0 | Worker RPC |
| tailwindcss, @tailwindcss/vite | MIT | Styling |
| vite | MIT | Build/dev server |
| typescript | Apache-2.0 | Types |
| vitest | MIT | Unit tests |
| @playwright/test | Apache-2.0 | E2E smoke |
| @fontsource/space-grotesk, ibm-plex-sans, ibm-plex-mono, vazirmatn | OFL-1.1 | Fonts |
| @biomejs/biome | MIT | Lint/format |
| katex, @types/katex | MIT | Math typesetting in theory panels |

## Backend and tools

| Package | License | Use |
|---|---|---|
| fastapi | MIT | API |
| uvicorn | BSD-3-Clause | ASGI server |
| pydantic, pydantic-settings | MIT | Validation/settings |
| pillow | HPND | Image decoding |
| numpy | BSD-3-Clause | Numeric work, golden vectors |
| python-multipart | Apache-2.0 | Uploads |
| pytest, pytest-asyncio, httpx | MIT | API tests |
| ruff | MIT | Python lint |
| mypy | MIT | Python types |

## Runtime images

| Image | License | Use |
|---|---|---|
| python:3.12-slim | PSF / Debian | API runtime |
| node:22-slim | MIT / Debian | Web build |
| caddy:2-alpine | Apache-2.0 | Static + reverse proxy |

Codec subprocesses (cjxl, heif-enc, opj_compress) are added in the compression wave; their licenses will be recorded here before shipping.
