# Factory Configuration — F1 Fantasy

## Goal

F1 Fantasy league web application — multiplayer game where users pick F1 drivers and score points based on real race results. Built with Next.js 15, Prisma, NextAuth, TypeScript, and Tailwind CSS.

## Scope

### Mutable

- `src/` — all application source code (components, pages, API routes, utilities)
- `prisma/` — schema and migrations
- `eval/` — evaluation scripts

### Fixed (read-only)

- `package.json` (except for adding dev dependencies)
- `next.config.ts`
- `tsconfig.json`

## Guards

- Do not delete or overwrite existing Prisma migrations
- Do not remove authentication flows
- Do not introduce secrets or credentials in code
- Do not modify the database schema without a corresponding migration
- Do not remove or weaken input validation (Zod schemas, HTML sanitization)

## Eval

command: python3 eval/score.py
threshold: 0.5

## Eval Dimensions

| Dimension     | Weight | Command              | Parser    |
|---------------|--------|----------------------|-----------|
| lint          | 0.667  | `npm run lint`       | exit_code |
| type_check    | 0.200  | `npx tsc --noEmit`   | exit_code |
| observability | 0.133  | (inline)             | json      |

## Smoke Test

npm run build

## Target Branch

main
