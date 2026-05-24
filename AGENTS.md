<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Urovo Projects Agent Guide

## Project Shape

- This is a private Next.js App Router app on Next `16.2.4`, React `19.2.4`, TypeScript, ESLint flat config, and Tailwind CSS v4.
- The app is a local project workspace for Urovo support work. It reads and writes JSON files under `PROJECTS_ROOT`; it is not backed by a database.
- The main UI is the client component `components/ProjectsWorkspace.tsx`. Feature components live under `components/projects-workspace/`; public read-only preview UI lives under `components/public-preview/`.
- Server-side domain logic lives in `lib/`. Prefer extending these helpers over duplicating parsing, normalization, validation, sorting, or filesystem access in route handlers.

## Next.js 16 Rules

- Before changing pages, layouts, route handlers, caching, config, or runtime behavior, read the matching bundled guide under `node_modules/next/dist/docs/`.
- In App Router pages, `params` and `searchParams` are promises. Await them, or use React `use()` only in client components.
- In App Router route handlers, `context.params` is a promise. Await it before reading dynamic segments.
- Route handlers that touch the filesystem, Cloudinary, or Qwen must stay on the Node runtime with `export const runtime = "nodejs";`.
- Use Web `Request`/`Response` APIs and `Response.json(...)` in route handlers. Keep API error responses as JSON with an `error` field, matching existing routes.

## Local Data Model

- `PROJECTS_ROOT` contains country folders, and project folders must start with `proj_`. Project keys are always `<country>/<proj_folder>`.
- Project files are `project.json`, `overview.json`, `tickets.json`, and `requirements.json`. Missing overview, ticket, and requirement files are treated as empty sets.
- `lib/projects.ts` owns project path safety, JSON reads/writes, atomic writes, default values, ID generation, normalization, and sorting. Use `projectKeyFromSegments`, `readTickets`, `writeTickets`, `readRequirements`, `writeRequirements`, `readOverview`, and `writeOverview`.
- Never build paths from request data directly. Validate path segments through the project helpers.
- Local file references must remain inside a project `docs/` folder. Use `lib/local-references.ts`; do not bypass its path normalization or escape checks.
- Timestamps are intentionally generated in Beijing time through `lib/time.ts`. Use `beijingNowIsoString`, `beijingNowLogTime`, or `beijingTodayDate` instead of ad hoc `new Date().toISOString()` for app records.

## Domain Conventions

- Ticket statuses are `pending_internal`, `pending_customer`, and `resolved`; priorities are `low`, `medium`, `high`, and `urgent`.
- Requirement statuses are `pending`, `in_progress`, `testing`, and `finished`.
- Overview demand IDs use `DEM-###`; requirement IDs use `REQ-###`; ticket IDs use a two-letter project-name prefix plus `-###`.
- Records may have a stable `uuid` in addition to a display `id`. Use `visibleEntityId` when writing change-log entries so logs can track UUID-backed entities while showing the display ID.
- Mutations that create, update, delete, link, unlink, or add timeline/event entries should append change logs through `appendChangeLogs` unless the existing nearby route deliberately does not log that kind of change.
- Ticket deletion is blocked when requirements link to the ticket. Requirement deletion is blocked when overview demands link to the requirement. Preserve the existing `409` blocker response shapes.

## External Integrations

- Cloudinary asset routes depend on `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Keep the 100 MB per-file limit from `MAX_ASSET_BYTES`.
- Assets are stored under `urovo-projects/<country>/<project>/<tickets|requirements>/<uuid-or-id>`. Use `cloudinaryAssetPrefix` and reject deletes whose `publicId` is outside the expected prefix.
- Qwen report and analysis calls depend on `QWEN_API_KEY` and use the DashScope OpenAI-compatible chat completions endpoint. Keep prompts grounded in stored records only; do not invent missing project facts.
- Report generation also depends on `CHANGE_LOG.json` and `report_prompt.md` inside `PROJECTS_ROOT`.

## Frontend Conventions

- Keep the operational dashboard style: dense, restrained, scan-friendly UI with slate borders/backgrounds, small text, rounded-lg controls, and utility classes colocated in JSX.
- Reuse shared UI from `components/projects-workspace/ui`, labels from `labels.ts`, draft conversion helpers from `drafts.ts`, formatting helpers from `formatters.ts`, and API helpers from `api-client.ts`.
- Client API calls should use `api<T>()`; it handles JSON headers, FormData uploads, and `ApiError`.
- Preserve dirty-state guards before changing selected tickets, requirements, overview settings, or overview demands.
- Date inputs generally store a date-only value in the UI and send `T00:00:00` through the draft API helpers for timeline/event records.

## Commands

- Install dependencies with `npm install`.
- Run development on port `3824` with `npm run dev`.
- Build with `npm run build`; serve the production build on port `4824` with `npm run start`.
- Run lint with `npm run lint`.
- After meaningful code changes, run the most relevant available check, usually `npm run lint`, and run `npm run build` for route, config, or type-sensitive changes when practical.
