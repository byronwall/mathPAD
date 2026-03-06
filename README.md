# mathPAD (SolidJS SPA)

A Mathcad-inspired worksheet app built with SolidJS + Vite + pnpm.

## Current capabilities

- Click-to-place worksheet rows on a freeform canvas
- Top-to-bottom evaluation based on row position
- Keyboard flow:
  - `:` to move from assignment to expression context
  - `=` to evaluate/show value
  - `Enter` to create a row below
  - bare `Esc` to remove temporary empty rows
- Drag rows to reorder calculations
- Unit-aware expression engine (variables, custom functions, conversions)
- Units reference modal
- Flat text modal (editable tab-separated worksheet view)
- Save/load named worksheets from `localStorage`
- Built-in engineering example sheets

## Project scripts

- `pnpm dev` - start local dev server
- `pnpm codex:play` - run on `http://127.0.0.1:4173` for Codex/browser play
- `pnpm build` - type-check + production build
- `pnpm preview` - preview production build

## Build and deploy (GitHub Pages)

This repo includes a Pages workflow at `.github/workflows/pages.yml`.

How it works:

1. Installs dependencies with pnpm
2. Sets `VITE_BASE_PATH` automatically:
   - `"/"` for user/org pages repos (for example `owner.github.io`)
   - `"/<repo>/"` for project pages repos (for example `/mathPAD/`)
3. Runs `pnpm build`
4. Deploys `dist/` using GitHub Pages actions

### Required GitHub setting

- Repository `Settings -> Pages -> Source`: set to **GitHub Actions**

## Legacy reference

- `mathpad.html` is retained as the original single-file legacy implementation.
- Main evaluator logic lives in `src/lib/mathEngine.ts`.
