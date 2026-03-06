# mathPAD (SolidJS SPA)

This repo modernizes the original single-file `mathpad.html` into a SolidJS single page app using a stock Vite + Solid setup and `pnpm` tooling.

## What Was Migrated

- Worksheet row model (`assign`, `expression`, `output units`) with top-to-bottom evaluation
- Variable assignment and custom function assignment (`f(x) = ...` style)
- Expression parsing with `+ - * / ^`, parentheses, and implicit multiplication
- Unit-aware arithmetic and conversion output fields
- Built-in math functions (`sin`, `cos`, `sqrt`, `log`, etc.) with unit safety checks

## Project Scripts

- `pnpm dev` - Start local dev server
- `pnpm codex:play` - Run app on `http://127.0.0.1:4173` for Codex/browser play
- `pnpm build` - Type-check and build for production
- `pnpm preview` - Preview production build

## Notes

- Legacy file `mathpad.html` is retained as the original reference implementation.
- Main evaluation logic now lives in `src/lib/mathEngine.ts`.
