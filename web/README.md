# Animdle web

Next.js (App Router, TypeScript) front end for the Animdle game. Reads game data from Supabase, which is exported
from the BigQuery marts (see `../warehouse/export_supabase.py`).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (lint: npm run lint)
```

## Layout
- `src/app/` routes. `page.tsx` is the home page; game screens will live under `/play/[mode]/[play]` and
  `/higher-lower/[kind]`.
- `src/components/` UI pieces: `Wordmark` (logo with its props), `MenaceSfx`, `ClueTile`, `ThemeToggle`,
  `home/` panels.
- `src/config/game.ts` game rules and route helpers. Limits must match the Supabase functions in
  `../warehouse/supabase_schema.sql`.
- `src/app/globals.css` design tokens. Night is the default theme; `<html data-theme="day">` switches to day.
