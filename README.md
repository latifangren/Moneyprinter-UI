# Moneyprinter-UI

`Moneyprinter-UI` is a frontend-only React + Vite interface for [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo).

This project does **not** include the MoneyPrinterTurbo backend. It talks to an existing FastAPI server, then uses that API for script generation, term generation, video task submission, task polling, and output preview.

## What This Project Is

- React UI for MoneyPrinterTurbo workflows
- Vite development and build setup
- Client-side API layer for live backend calls
- Local dashboard for status, create flow, and task monitoring

## What This Project Is Not

- Not backend API code
- Not bundled model, media, or rendering pipeline logic
- Not complete asset management yet
- Not replacement for upstream MoneyPrinterTurbo

For backend setup and core video generation engine, use upstream MoneyPrinterTurbo:

- Upstream repo: <https://github.com/harry0703/MoneyPrinterTurbo>

## Current Scope

Current UI matches implemented pages and flows split across `src/App.tsx`, `src/pages/*`, `src/components/*`, and shared helpers in `src/api.ts`, `src/taskModel.ts`, `src/studioForm.ts`, `src/content.ts`, and `src/outputUrl.ts`.

| Area | Current state |
| --- | --- |
| Dashboard | Implemented, includes backend status probe and workflow summary |
| Create Studio | Implemented, can generate script, generate terms, submit video task, poll task status, preview outputs |
| Tasks page | Implemented, lists backend tasks, merges backend results with tasks created in current browser session |
| Output preview | Implemented for `/tasks/...` output URLs, including direct links and inline video preview when file type is video |
| Assets page | Placeholder UI only |
| Some shell or action buttons | Placeholder only, no backend action wired |
| Settings page | Implemented for API base URL reference and status refresh |

## Backend Requirement

This UI expects a running MoneyPrinterTurbo FastAPI backend.

If you are using this UI inside the local portable Windows bundle at the parent directory, you can start backend with:

```bat
api.bat
```

If you are running upstream MoneyPrinterTurbo directly, common backend start commands are:

```bat
python main.py
```

```bash
uv run python main.py
```

During local development, browser calls default to same-origin dev proxy:

```text
same-origin dev proxy
```

Vite forwards matching `/api/*` and `/tasks/*` requests to the local MoneyPrinterTurbo backend at `http://127.0.0.1:8080` without rewriting path prefixes.

If you are not using the dev proxy, set `VITE_API_BASE_URL` to the backend origin you want the browser to call directly.

Once backend is up, API docs are usually available at:

```text
http://127.0.0.1:8080/docs
```

## Frontend Setup

From `Moneyprinter-UI/`:

```bash
npm install
```

Optional, copy environment example if you want to call a backend origin directly instead of using the local dev proxy:

```bash
cp .env.example .env
```

Start dev server:

```bash
npm run dev
```

Create production build:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

Current package scripts:

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite --host 127.0.0.1 --port 5173` | Local development server with `/api` and `/tasks` proxy |
| `build` | `tsc -b && vite build` | Type check and production build |
| `test:unit` | `node --test src/outputUrl.test.mjs src/taskModel.test.mjs` | Run output URL resolver and task helper unit tests |
| `preview` | `vite preview --host 127.0.0.1 --port 4173` | Preview built app |

## Environment Variables

Example `.env.example`:

```env
# Optional: set this only when the browser should call a backend origin directly.
# Leave unset during local Vite development to use the /api and /tasks dev proxy.
# VITE_API_BASE_URL=http://127.0.0.1:8080
```

Recommended direct-backend setting for non-proxy use:

```env
VITE_API_BASE_URL=http://127.0.0.1:8080
```

Example remote setting:

```env
VITE_API_BASE_URL=https://example.com
```

Important note:

- `VITE_*` values are compiled into client bundle
- Treat them as public configuration, not secrets
- Don't put API keys, tokens, or private credentials in Vite env variables meant for browser code

If `VITE_API_BASE_URL` is empty or invalid, app falls back to same-origin requests, which work with the Vite dev proxy.

## API Integration

Current frontend calls these MoneyPrinterTurbo backend endpoints.

| Purpose | Method | Endpoint | Used by UI |
| --- | --- | --- | --- |
| Status probe | `GET` | `/api/v1/tasks?page=1&page_size=1` | Dashboard and Settings status check |
| Generate script | `POST` | `/api/v1/scripts` | Create Studio |
| Generate search terms | `POST` | `/api/v1/terms` | Create Studio |
| Create video task | `POST` | `/api/v1/videos` | Create Studio |
| Task list | `GET` | `/api/v1/tasks` | Tasks page, status probe |
| Task detail | `GET` | `/api/v1/tasks/{task_id}` | Create Studio polling |
| Output preview | `GET` | `/tasks/...` | Inline video preview and output links |

### Task State Mapping

Current frontend interprets backend task states like this:

| Backend state | UI meaning |
| --- | --- |
| `-1` | Failed |
| `1` | Complete |
| `4` | Processing |
| Any other value | Submitted |

## How Current Create Flow Works

1. Enter video subject.
2. Generate script through `POST /api/v1/scripts`.
3. Edit script if needed.
4. Generate terms through `POST /api/v1/terms`.
5. Submit render through `POST /api/v1/videos`.
6. Poll task with `GET /api/v1/tasks/{task_id}`.
7. Preview returned `/tasks/...` outputs when backend finishes.

## Pages

### Dashboard

- Shows backend connection status
- Shows workflow summary cards
- Includes guidance for next actions

### Create Studio

- Subject input
- Language, paragraph count, and term count controls
- Script generation
- Terms generation
- Video submission
- Live progress polling
- Output preview for returned files

### Tasks

- Fetches live backend task list
- Refreshes periodically when backend is online
- Merges backend tasks with tasks submitted in current UI session
- Shows progress, status, and output links

### Assets

- Placeholder only
- Presentational counts only
- No real asset upload or management flow yet

### Settings

- Shows `VITE_API_BASE_URL`
- Shows default backend URL
- Shows status probe path
- Lets user refresh backend status check

## Local Portable Windows Context

This repository sits inside portable Windows bundle `MoneyPrinterTurbo-Portable-Windows`.

That matters because:

- Parent bundle can start backend with `api.bat`
- Bundled backend checkout lives in sibling `MoneyPrinterTurbo/`
- Vite dev proxy target matches local FastAPI default at `http://127.0.0.1:8080`

For non-portable use, point `VITE_API_BASE_URL` at any reachable MoneyPrinterTurbo backend instance.

## Compatibility

This README is written against current local implementation and local backend integration assumptions.

- Frontend checked against `src/App.tsx`, `src/pages/*`, `src/components/*`, `src/api.ts`, `src/taskModel.ts`, `src/studioForm.ts`, `src/content.ts`, `src/outputUrl.ts`, `src/outputUrl.test.mjs`, `.env.example`, and `package.json`
- Backend compatibility note based on bundled local `MoneyPrinterTurbo/` checkout
- Tested against project knowledge base reference for upstream commit `042deb8`

Compatibility note:

> Tested against local bundled MoneyPrinterTurbo checkout aligned with upstream commit `042deb8` from project knowledge base.

## Known Limitations

- Frontend depends on separately running MoneyPrinterTurbo backend
- Assets page is still placeholder UI
- Some action buttons in dashboard and assets area are not wired to backend behavior
- Topbar search box is presentational only; Tasks page search and filters are wired to the local task list
- No authentication flow documented or enforced by this UI layer
- UI assumes backend responses follow MoneyPrinterTurbo response envelope shape with `status`, optional `message`, and `data`
- Output preview depends on backend exposing generated files under `/tasks`

## Roadmap

- Real asset browser and upload flow
- Better handling for long-running jobs and retries
- More complete settings for generation defaults
- Clearer backend error surfacing across all workflow steps
- Production deployment notes for hosting frontend against remote backend

## Development Notes

- API base URL normalization lives in `src/api.ts`
- Same-origin is the default browser request path in dev when `VITE_API_BASE_URL` is unset or blank
- Backend reachability probe uses `GET /api/v1/tasks?page=1&page_size=1`
- Output URL normalization lives in `src/outputUrl.ts` and is covered by `npm run test:unit`
- Output links are normalized to backend `/tasks/...` paths before preview
- Create Studio polling runs on interval and stops after capped attempts if task never resolves

## License

License: TBD

MoneyPrinterTurbo is separate upstream project with its own repository, maintenance, and licensing terms:

- <https://github.com/harry0703/MoneyPrinterTurbo>
