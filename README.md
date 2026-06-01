# TodoLite

A minimal Windows desktop todo layer with iOS 26 liquid-glass aesthetics.

Two surfaces, one purpose: **get things done without thinking about the tool.**

- **Widget** — stays on your desktop. Checkbox, content, DDL. Expand for detail. That's it.
- **Panel** — hides in the system tray. Full task management, completed records by date, settings.

## Philosophy

> Practical > beautiful, but the beauty bar is extremely high.
> Minimal does not mean disposable.

- **No redundant fields.** A task has `content`, `ddl`, and optional `detail`. No `completed` boolean — completion is represented by *location* (active → completed[date]). No `createdAt`, `updatedAt`, `priority`, `tags`, `category`. You don't need them.
- **No "today/tomorrow" abstractions.** You give the exact date and time: `YYYY-MM-DD HH:mm:ss`. That's what you mean, that's what we store.
- **Completed items are grouped by date**, not scattered. One glance tells you what you finished when.
- **Removed items are retained**, not lost. They stay in `removed[]` in case you need them back.

## Data Model

```ts
type TodoItem = {
  id: string;
  content: string;
  ddl: string;    // "YYYY-MM-DD HH:mm:ss"
  detail?: string;
};
```

Storage structure (`data/todos.json`):

```json
{
  "active": [],
  "completed": { "2026-06-01": [] },
  "removed": []
}
```

## Architecture

```
TodoLite/
├── electron/
│   ├── main.js          # App lifecycle, windows, tray, IPC handlers
│   └── preload.js       # Secure context bridge (contextIsolation)
├── src/
│   ├── widget.html      # Desktop widget markup
│   ├── widget.js        # Widget logic (render, complete, sort)
│   ├── widget.css       # Widget styles + completion animation
│   ├── panel.html       # Full panel markup (Tasks + Settings pages)
│   ├── panel.js         # Panel logic (CRUD, settings, font injection)
│   ├── panel.css        # Panel styles
│   └── shared.css       # Glass effect, typography, shared tokens
├── data/
│   ├── todos.json       # Active / completed / removed tasks
│   ├── settings.json    # User preferences
│   └── backups/         # Auto-backup (max 30, timestamped)
├── fonts/               # Drop .ttf/.otf/.woff/.woff2 here
├── package.json
└── README.md
```

## Features

### Widget (Desktop Layer)
- Checkbox to complete — animated line sweep left-to-right, then collapse
- Click to expand detail; double-click to edit
- Sort by DDL toggle
- Add new task inline
- Liquid-glass background with configurable blur, opacity, radius

### Panel (Tray-Open Full Page)
- **Tasks page** — active list + completed-by-date archive
- **Settings page** — font family (reads `fonts/`), font size, glass opacity, blur strength, corner radius, window layer (desktop / normal / topmost)
- Sidebar navigation with animated transitions

### Data Safety
- Atomic writes (write to `.tmp`, then rename)
- Auto-backup before every task mutation (keeps last 30)
- Open data / backup folders from settings

## Run

```bash
npm install
npm run dev
```

Requires Node.js. Uses Electron — no native dependencies, no SQLite binary builds.

## Custom Fonts

Drop `.ttf`, `.otf`, `.woff`, or `.woff2` files into `fonts/`, then restart TodoLite or reopen settings. They'll appear in the font selector.

## What's Done

- [x] Electron dual-window architecture (widget + panel)
- [x] JSON file storage with atomic writes and auto-backup
- [x] Minimal data model (content, ddl, detail only)
- [x] Completion by location (active → completed[date])
- [x] Desktop widget with checkbox, content, DDL, expandable detail
- [x] Completion animation: flowing line sweep + collapse
- [x] Panel: Tasks page with active + completed-by-date sections
- [x] Panel: Settings page (font, size, glass, blur, radius, layer)
- [x] Custom font injection from `fonts/` directory
- [x] System tray with click-to-toggle panel
- [x] iOS 26 liquid-glass aesthetic (backdrop-filter, radial highlights, grain texture)
- [x] Configurable window level (desktop / normal / topmost)
- [x] Sort by DDL on widget

## License

MIT
