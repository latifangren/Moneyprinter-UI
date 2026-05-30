# Moneyprinter-UI

`Moneyprinter-UI` is a frontend-only React + Vite interface for [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo).

This project does **not** include the MoneyPrinterTurbo backend. It talks to an existing FastAPI server, then uses that API for script generation, term generation, video task submission, task polling, and output preview.

## What This Project Is

- React UI for MoneyPrinterTurbo workflows
- Vite development and build setup
- Client-side API layer for live backend calls
- Local dashboard for status, create flow, task monitoring, and read-only output browsing

## What This Project Is Not

- Not backend API code
- Not bundled model, media, or rendering pipeline logic
- Not media upload, delete, or library management code
- Not replacement for upstream MoneyPrinterTurbo

For backend setup and core video generation engine, use upstream MoneyPrinterTurbo:

- Upstream repo: <https://github.com/harry0703/MoneyPrinterTurbo>

## Current Scope

Current UI matches implemented pages and flows split across `src/App.tsx`, `src/pages/*`, `src/components/*`, and shared helpers in `src/api.ts`, `src/taskModel.ts`, `src/studioForm.ts`, `src/content.ts`, and `src/outputUrl.ts`.

| Area | Current state |
| --- | --- |
| Dashboard | Implemented, includes backend status probe and workflow summary |
| Create Studio | Implemented, can save/restore browser-local Studio defaults, generate script, generate terms, submit video task, poll task status, preview outputs |
| Tasks page | Implemented, lists backend tasks, merges backend results with tasks created in current browser session |
| Output preview | Implemented for `/tasks/...` output URLs, including direct links and inline video preview when file type is video |
| Assets page | Implemented, read-only generated output browser for task outputs from `/api/v1/tasks` and current-session submissions |
| Some shell or action buttons | Placeholder only, no backend action wired |
| Settings page | Implemented for backend connection details, status refresh guidance, and browser-local Studio defaults management |

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
| `test:unit` | `node --test src/outputUrl.test.mjs src/taskModel.test.mjs src/assetsModel.test.mjs src/studioForm.test.mjs src/api.test.mjs` | Run output URL resolver, task helper, generated asset helper, Studio form default, and API metadata unit tests |
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
| Task list | `GET` | `/api/v1/tasks` | Tasks page, Assets page, status probe |
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

1. Optionally save, restore, or reset browser-local Studio defaults for language, paragraph count, terms amount, voice name, video aspect, video source, and subtitles.
2. Enter video subject.
3. Generate script through `POST /api/v1/scripts`.
4. Edit script if needed.
5. Generate terms through `POST /api/v1/terms`.
6. Submit render through `POST /api/v1/videos`.
7. Poll task with `GET /api/v1/tasks/{task_id}`.
8. Preview returned `/tasks/...` outputs when backend finishes.

Studio defaults use browser `localStorage` only. They persist across browser reloads on the same origin, make no backend calls, and never store subject, script text, or generated terms.

## Pages

### Dashboard

- Shows backend connection status
- Shows workflow summary cards
- Includes guidance for next actions

### Create Studio

- Subject input
- Browser-local Studio defaults for language, paragraph count, terms amount, voice name, video aspect, video source, and subtitles
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

- Read-only browser for generated task outputs
- Fetches `GET /api/v1/tasks?page=1&page_size=50` only when backend status is online
- Merges backend task outputs with outputs submitted in the current browser session
- Shows safe output fields only: filename, subject, task ID, status, kind, updated time, and output link
- Supports search by filename, subject, or task ID plus output-kind and task-status filters
- Previews `.mp4`, `.webm`, and `.ogg` outputs inline through normalized `/tasks/...` URLs
- Does not upload, delete, POST, or call generation endpoints

### Settings

- Shows current backend status and lets user refresh the existing read-only status probe
- Shows `VITE_API_BASE_URL`, local backend default, same-origin proxy label, and status probe path
- Explains that backend target changes require editing `VITE_API_BASE_URL`, then restarting dev server or rebuilding
- Manages browser-local Studio defaults for language, paragraph count, terms amount, voice name, video aspect, video source, and subtitles
- Shows storage key and saved, missing, corrupt, or unavailable storage state inline
- Never stores subject, script text, or generated terms
- Makes no backend config writes and does not call generation endpoints

## Local Portable Windows Context

This repository sits inside portable Windows bundle `MoneyPrinterTurbo-Portable-Windows`.

That matters because:

- Parent bundle can start backend with `api.bat`
- Bundled backend checkout lives in sibling `MoneyPrinterTurbo/`
- Vite dev proxy target matches local FastAPI default at `http://127.0.0.1:8080`

For non-portable use, point `VITE_API_BASE_URL` at any reachable MoneyPrinterTurbo backend instance.

## Compatibility

This README is written against current local implementation and local backend integration assumptions.

- Frontend checked against `src/App.tsx`, `src/pages/*`, `src/components/*`, `src/api.ts`, `src/taskModel.ts`, `src/assetsModel.ts`, `src/studioForm.ts`, `src/content.ts`, `src/outputUrl.ts`, `src/outputUrl.test.mjs`, `src/assetsModel.test.mjs`, `src/studioForm.test.mjs`, `.env.example`, and `package.json`
- Backend compatibility note based on bundled local `MoneyPrinterTurbo/` checkout
- Tested against project knowledge base reference for upstream commit `042deb8`

Compatibility note:

> Tested against local bundled MoneyPrinterTurbo checkout aligned with upstream commit `042deb8` from project knowledge base.

## Known Limitations

- Frontend depends on separately running MoneyPrinterTurbo backend
- Assets page is read-only and depends on existing task output paths; it does not manage reusable asset libraries
- Some action buttons in dashboard are not wired to backend behavior
- Topbar search box is presentational only; Tasks page search and filters are wired to the local task list
- No authentication flow documented or enforced by this UI layer
- Studio defaults are per browser and per origin because they live only in `localStorage`
- Settings can save, restore, and reset only browser-local Studio defaults; it cannot change backend environment variables at runtime
- UI assumes backend responses follow MoneyPrinterTurbo response envelope shape with `status`, optional `message`, and `data`
- Output preview depends on backend exposing generated files under `/tasks`

## Roadmap

- Upload/delete asset management separate from current read-only generated output browser
- Better handling for long-running jobs and retries
- More complete settings for generation defaults beyond current browser-local Studio preset fields
- Clearer backend error surfacing across all workflow steps
- Production deployment notes for hosting frontend against remote backend

## Development Notes

- API base URL normalization lives in `src/api.ts`
- Same-origin is the default browser request path in dev when `VITE_API_BASE_URL` is unset or blank
- Backend reachability probe uses `GET /api/v1/tasks?page=1&page_size=1`
- Backend settings metadata is exported from `src/api.ts` and covered by `src/api.test.mjs`
- Output URL normalization lives in `src/outputUrl.ts` and is covered by `npm run test:unit`
- Output links are normalized to backend `/tasks/...` paths before preview
- Assets helper logic lives in `src/assetsModel.ts` and is covered by `src/assetsModel.test.mjs`
- Create Studio polling runs on interval and stops after capped attempts if task never resolves
- Studio default storage helpers live in `src/studioForm.ts` and are covered by `src/studioForm.test.mjs`

## License

License: TBD

MoneyPrinterTurbo is separate upstream project with its own repository, maintenance, and licensing terms:

- <https://github.com/harry0703/MoneyPrinterTurbo>
