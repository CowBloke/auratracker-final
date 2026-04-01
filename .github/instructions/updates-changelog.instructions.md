---
description: "Reference format for changelog entries in backend/src/routes/changelog.ts when a changelog update is requested."
name: "Changelog Entry Format"
applyTo: "backend/src/routes/changelog.ts"
---
## Changelog Format

Use this format only when a changelog update is explicitly requested.

Recommended: keep one changelog card per day.
- First, find whether an entry with the same `date` already exists.
- If it exists, append new lines to its `items` array (and optionally refine `summary`).
- Create a brand new entry only when no entry exists for that date.

Entries are synced to the DB on next server start via `ensureSeeded()`. Structure:

```ts
{
  id: 'YYYY-MM-DD-short-slug',   // unique, kebab-case
  date: 'YYYY-MM-DD',
  title: 'Titre court',
  summary: 'Une phrase résumant les changements.',
  items: [
    { category: 'BIG_FEATURE', text: '**Titre** — Description.', order: 0 },
    { category: 'SMALL_FEATURE', text: '**Titre** — Description.', order: 0 },
    { category: 'BUG_FIX', text: '**Titre** — Description.', order: 0 },
  ],
},
```

Categories: `BIG_FEATURE` (grandes fonctionnalités), `SMALL_FEATURE` (petites améliorations), `BUG_FIX` (correctifs).

If you create a new date entry, add it at the top of the array. File: `backend/src/routes/changelog.ts`.