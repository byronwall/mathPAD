# AGENTS.md - mathPAD Solid SPA

Repository-level guidance for contributors and coding agents.

## Quick Rules

- Use `pnpm` for all package and script commands.
- Keep this app as a client-side SolidJS SPA (Vite + Solid), not SolidStart SSR.
- Prefer typed utility modules in `src/lib/*` for parser/evaluator logic.
- Preserve worksheet execution order: rows evaluate top-to-bottom.
- For unit math changes, keep dimensional checks strict (add/sub only for matching units).
- For function support, keep both custom worksheet functions and selected Math built-ins.
- Use plain CSS (`src/index.css`) for styling unless explicitly asked to introduce a CSS framework.
- Keep reusable UI behavior in components/modules, not inline event-heavy logic.
- Do not delete `mathpad.html`; it is the legacy baseline/reference.

## Pulled Solid Agent Context

These conventions were pulled and adapted from `/Users/byronwall/Projects/solid-start-panda-park-ui/AGENTS.md` for this repo:

- Use `pnpm` consistently.
- Keep reusable UI out of route-level logic and avoid monolithic files.
- Prefer explicit labels for form inputs.
- Keep first-render DOM stable and avoid unnecessary client/server divergence patterns.
- Use concise, predictable component composition and keep data logic in dedicated modules.

## Repo Structure

- Solid app entry: `src/main.tsx`
- Main UI: `src/App.tsx`
- Math parser/evaluator engine: `src/lib/mathEngine.ts`
- Global styles: `src/index.css`
- Legacy app reference: `mathpad.html`

## Development Commands

- `pnpm install`
- `pnpm dev`
- `pnpm codex:play` (fixed localhost run action for Codex browser play)
- `pnpm build`
- `pnpm preview`
