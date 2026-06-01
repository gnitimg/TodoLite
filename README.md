# TodoLite

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Gnitimg-orange.svg)](https://github.com/gnitimg)
[![Release](https://img.shields.io/badge/Release-v0.1.0-green.svg)](https://github.com/gnitimg/TodoLite/releases/download/v0.1.0/TodoLite_installer.exe)

A minimal Windows desktop todo layer with iOS 26 liquid-glass aesthetics.

Two surfaces, one purpose: **get things done without thinking about the tool.**

- **Widget** — stays on your desktop. Checkbox, content, DDL. Expand for detail. That's it.
- **Panel** — hides in the system tray. Full task management, completed records by date, settings.

## Download

[**Download TodoLite v0.1.0 Installer**](https://github.com/gnitimg/TodoLite/releases/download/v0.1.0/TodoLite_installer.exe)

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
│   ├── main.js          # App lifecycle, windows, tray, IPC, font scanning
│   └── preload.js       # Secure context bridge (contextIsolation)
├── src/
│   ├── widget.html      # Desktop widget markup
│   ├── widget.js        # Widget logic (render, complete, sort, i18n)
│   ├── widget.css       # Widget styles + completion animation
│   ├── panel.html       # Full panel markup (Tasks + Settings pages)
│   ├── panel.js         # Panel logic (CRUD, settings, accent wheel, i18n)
│   ├── panel.css        # Panel styles + traffic lights
│   ├── shared.css       # Glass base, liquid-select, liquid-toggle, typography
│   ├── motion_patch.css # Glow lifecycle, FLIP layout, particles, context menu
│   └── motion_patch.js  # Self-contained motion/interaction module
├── data/
│   ├── todos.json       # Active / completed / removed tasks
│   ├── settings.json    # User preferences (persisted in userData)
│   └── backups/         # Auto-backup (max 30, timestamped)
├── fonts/               # Drop .ttf/.otf/.woff/.woff2 here
├── package.json
└── README.md
```

## Features

### Widget (Desktop Layer)
- Checkbox to complete — dark-gray line sweep left-to-right, then collapse with particle effect
- Embedded wallpaper effect: ultra-low glass opacity, mouse-tracking glow
- Right-click context menu (edit / delete with particle animation)
- Custom DDL picker (Y/M/D/H/M/S grid, no native datetime-local)
- Click to expand detail; double-click to edit
- Sort by DDL toggle (persisted)
- Add new task inline
- i18n (zh-CN / en-US)

### Panel (Tray-Open Full Page)
- **Tasks page** — active list + completed-by-date archive
- **Settings page** — three-column layout (Global / Widget / Panel)
- macOS-style traffic light buttons (close / minimize / zoom)
- Animated panel zoom (easeOutCubic, replaces native maximize)
- Sidebar navigation
- Lighter glass effect for the full page

### Settings

| Section | Controls |
|---------|----------|
| **Global** | Font (system + project), font size, language, accent color (conic wheel), startup toggle |
| **Widget** | Glass opacity, blur, corner radius |
| **Panel** | Glass opacity, blur, corner radius, layer (desktop / normal / topmost) |

### Glass & Motion
- iOS 26 liquid-glass aesthetic (backdrop-filter, radial glow, grain texture)
- Mouse-tracking glow with edge sensors (enter/leave detection)
- Glow tri-state: lit (hover highlight) / idle (fade diffusion) / default
- FLIP layout animation on task reorder
- Particle deletion effect (accent-colored dots disperse)
- Liquid-select, liquid-toggle glass-styled components

### Fonts
- Windows system font scanning from `C:\Windows\Fonts`
- Project fonts from `fonts/` directory
- Searchable glass-styled font dropdown
- Live font preview
- Safe font name sanitization

### Data Safety
- Atomic writes (write to `.tmp`, then rename)
- Auto-backup before every task mutation (keeps last 30)
- Data stored in `app.getPath('userData')` (survives app updates)
- Legacy data migration from project directory
- Open data / backup folders from settings

## Run (Development)

```bash
npm install
npm run dev
```

Requires Node.js. Uses Electron — no native dependencies, no SQLite binary builds.

## Custom Fonts

Drop `.ttf`, `.otf`, `.woff`, or `.woff2` files into `fonts/`. They appear in the font dropdown under "project fonts" alongside Windows system fonts.

## What's Done

- [x] Electron dual-window architecture (widget + panel)
- [x] JSON file storage with atomic writes and auto-backup
- [x] Minimal data model (content, ddl, detail only)
- [x] Completion by location (active → completed[date])
- [x] Desktop widget with checkbox, content, DDL, expandable detail
- [x] Completion animation: dark-gray line sweep + collapse + particles
- [x] Widget embedded wallpaper effect with mouse-tracking glow
- [x] Right-click context menu with particle deletion
- [x] Custom DDL picker (Y/M/D/H/M/S)
- [x] Panel: Tasks page with active + completed-by-date sections
- [x] Panel: three-column settings (Global / Widget / Panel)
- [x] Panel: macOS traffic light buttons with animated zoom
- [x] Accent color: conic-gradient wheel + presets
- [x] i18n: zh-CN / en-US with runtime switching
- [x] Startup toggle (launch at login)
- [x] Windows system font scanning + searchable dropdown
- [x] Custom font injection from `fonts/` directory
- [x] System tray with click-to-toggle panel
- [x] iOS 26 liquid-glass aesthetic with glow lifecycle
- [x] FLIP layout animation on task reorder
- [x] Configurable widget layer (desktop / normal / topmost)
- [x] Sort by DDL (persisted)
- [x] Window bounds persistence (position + size)

## License

MIT
