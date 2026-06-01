# TodoLite MVP

TodoLite is a minimal Windows desktop todo layer: quiet desktop widget + tray-opened full panel.

## Philosophy

Practical > beautiful, but the beauty bar is extremely high.
Minimal does not mean disposable. Finished and removed items are retained.

## Data model

A task only stores what the user actually cares about:

```ts
type TodoItem = {
  id: string;
  content: string;
  ddl: string; // YYYY-MM-DD HH:mm:ss
  detail?: string;
};
```

Completion is not a field on the task. It is represented by location:

```json
{
  "active": [],
  "completed": {
    "2026-06-01": []
  },
  "removed": []
}
```

## Run

```bash
npm install
npm run dev
```

## Notes

- First MVP uses JSON instead of SQLite to keep install small and native-build-free.
- Data is stored in `data/todos.json`.
- Before important writes, old data is copied to `data/backups`.
- Put `.ttf`, `.otf`, `.woff`, or `.woff2` files into `fonts/`, then restart TodoLite or reopen settings.
