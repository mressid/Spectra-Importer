# Instructions for AI assistants

Read README.md, then docs/ARCHITECTURE.md, then docs/TASKS.md and take the first unfinished task.
Rules: style only with the shared design tokens (`var(--ds-*)` from `src/styles/tokens.css`, a copy of accessories-store-system/design-tokens: see its README.md and admin/DESIGN.md; never edit the copy, change the tokens in the store repo and run `npm run tokens:sync`); never write a colour, radius or font size literal; do not change the contracts in `src/core/types.ts` without updating docs/ARCHITECTURE.md; every template change
touches schema + 3 examples + template README + registry; `npm test` and `npm run build` must pass before you stop;
do not add dependencies without a reason written in the commit message; no AI attribution lines in commits.
