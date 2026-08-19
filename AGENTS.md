# AGENTS.md

## Project Context

This started as a Base44 app scaffold but no longer uses the Base44 backend — auth, database, and file storage all run directly against a Supabase project (see `supabase/migration.sql` for the schema). Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup and environment variables.

## Key Files

- `src/`: frontend application source.
- `src/lib/supabase.js`: Supabase client (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- `src/lib/worldcrud.js`: single funnel for all data access — every Supabase query for the app's entities goes through here (column-scoped selects, image compression on upload, old-image cleanup). Extend this file rather than calling `supabase.from(...)` directly from a page/component.
- `src/lib/writingFactory/`: Xưởng Viết Truyện — `prompts.js` (bible/chương/rollup/team prompt builders), `bibleBuilder.js` (dựng text bible từ dữ liệu Story Bible).
- `src/lib/AuthContext.jsx`: Supabase Auth session/profile state.
- `supabase/migration.sql`: full schema + RLS + storage bucket — the source of truth for the database shape. Any schema change should be added here too (and re-run by the user in the Supabase SQL Editor — no automated migration runner in this project).
- `base44/entities/*.jsonc`: leftover from the Base44 scaffold, kept only as human-readable field documentation. Not read by the app at runtime.
- `.env.local`: local-only environment values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); never commit secrets.

## Working Notes

- `npm run dev` is the only local dev command now — there is no separate backend process to start.
- This is a single-admin app by design: RLS policies grant full access to any authenticated user rather than modeling per-user ownership. If the user asks to support multiple accounts with different permissions, that requires revisiting the RLS policies in `supabase/migration.sql`, not just frontend gating.
- I cannot run SQL against the user's Supabase project (no service role key, only what's in `.env.local`) — hand them SQL to run themselves in the Supabase Dashboard's SQL Editor for anything schema-related.
- Run the relevant checks from `package.json` before finishing code changes.
