# Urovo Projects

Local project workspace for tracking Urovo technical support work across
projects, tickets, requirements, overview demands, supporting files, and
generated progress reports.

The app is a Next.js App Router project. Data is read from and written directly
to JSON files under a local project data root configured with `PROJECTS_ROOT`.

## Features

- Project dashboard grouped by country and project folder.
- Ticket tracking with status, priority, next action, timeline events, local
  file references, and optional Cloudinary assets.
- Requirement tracking with status, timeline updates, related tickets, local
  file references, and optional Cloudinary assets.
- Project overview management for product models, services, descriptions, and
  customer-facing demand items.
- Public project preview at `/urovo-projects?project_id=<project_id>`.
- Date-range report generation using the Qwen chat completions API.

## Requirements

- Node.js 20 or newer.
- npm, or another package manager that can run the scripts in `package.json`.
- A local project data directory containing country/project folders.

## Configuration

Create `.env.local` in the repository root:

```env
PROJECTS_ROOT=/absolute/path/to/projects/root
```

`PROJECTS_ROOT` should contain country folders. Each project folder must start
with `proj_`:

```text
projects-root/
  China/
    proj_customer-terminal/
      project.json
      overview.json
      tickets.json
      requirements.json
      docs/
```

The JSON files are created or updated by the app where supported. Missing
`overview.json`, `tickets.json`, and `requirements.json` are treated as empty
data sets. `project.json` is used for project metadata.

### Optional: Cloudinary Assets

Ticket and requirement asset uploads require Cloudinary credentials:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Uploaded files are stored under a Cloudinary `urovo-projects/...` folder. The
app enforces a 100 MB upload limit per file.

### Optional: Qwen Reports

Report generation requires a Qwen API key and a report prompt file inside
`PROJECTS_ROOT`:

```env
QWEN_API_KEY=your_qwen_api_key
```

```text
projects-root/
  CHANGE_LOG.json
  report_prompt.md
```

Reports are generated from ticket and requirement change-log activity within the
selected date range.

Restart the dev server after changing `.env.local`.

## Development

Install dependencies:

```bash
npm install
```

Run the development server on port `3824`:

```bash
npm run dev
```

Open [http://localhost:3824](http://localhost:3824).

Useful scripts:

```bash
npm run lint
npm run build
npm run start
```

`npm run start` serves the production build on port `4824`, after
`npm run build`.

## Project Structure

- `app/` - App Router pages and API route handlers.
- `components/ProjectsWorkspace.tsx` - main client workspace.
- `components/projects-workspace/` - dashboard, tickets, requirements,
  overview, references, assets, dialogs, and shared UI.
- `components/public-preview/` - public project preview UI.
- `lib/projects.ts` - project JSON read/write and normalization.
- `lib/local-references.ts` - project `docs/` file browsing and downloads.
- `lib/cloudinary-assets.ts` - Cloudinary upload, list, and delete helpers.
- `lib/reports.ts` - date-range report context and Qwen request handling.

## Data Notes

- Project paths are always `<country>/<proj_folder>`.
- Local references must point to files inside the selected project's `docs/`
  folder.
- Ticket statuses are `pending_internal`, `pending_customer`, and `resolved`.
- Requirement statuses are `pending`, `in_progress`, `testing`, and `finished`.
- Timestamps are generated in Beijing time by the server helpers.
