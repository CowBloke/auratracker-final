## Changelog Rule

After completing any feature, fix, or visible change, add an entry directly to `SEED_ENTRIES` in `backend/src/routes/changelog.ts`. The entry is automatically synced to the DB on next server start via `ensureSeeded()`. Structure:

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

Categories: `BIG_FEATURE` (grandes fonctionnalités), `SMALL_FEATURE` (petites améliorations), `BUG_FIX` (correctifs). Add the new entry at the top of the array. File: `backend/src/routes/changelog.ts`.