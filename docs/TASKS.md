# Tasks for the next developer / LLM

Read [ARCHITECTURE.md](ARCHITECTURE.md) first (5 minutes), then work top to bottom. Keep functions pure where the
contract says so, and write a vitest test next to each stage (`npm test`). The patterns to copy are
`src/validate/validate.ts` + `validate.test.ts`. `npm run build` and `npm test` must stay green.

Requirements to run against a real store: the backend of `accessories-store-system` on `localhost:8080`
(`docker-compose up`, then `./gradlew bootRun` with `SEED_DEMO_DATA=true`; demo admin `admin@store.local` / `admin_password`).
`npm run dev` serves the tool on :5174 and proxies `/api` to it (`STORE_API_URL` overrides the address).

## 1. `loadStoreIndex` (`src/upload/storeIndex.ts`) — DONE
Read every page of brands, categories, tags, collections, products (and variants per product when needed) and return
`Partial<Record<ResourceKind, Map<identifier, storeId>>>`. Use `request()` from `api.ts`.
Done when: a test with a mocked `fetch` shows pagination is followed; `validateDocument`'s `existing` can be built from it.

## 2. `buildPlan` (`src/upload/plan.ts`)
One `toOperations(row)` per template following the table in ARCHITECTURE.md §4; placeholders `{brands:acme}`,
`{media:ring-gold-1}`; categories sorted parent-first (detect cycles → issue, not crash); `onConflict` is applied by the runner.
Done when: unit tests cover a simple product, a product with variants, a category tree, `media:` names resolved through the library (also inside `contentBlocks`), and the `images` gallery calls.

## 3. `runPlan` (`src/upload/run.ts`)
As described in the file's comment: ordering, small concurrency, placeholders, `blocked`, conflict lookup, abort,
progress callback, one automatic retry on 401 after re-login is NOT wanted (just report it) but retry on network errors twice.
Done when: tests with a fake store (an object implementing `request`/`uploadFile`) cover success, a 400 with field errors,
a failing parent blocking its children, and a second run being skipped.

## 4. UI: connect + images (`src/ui/`)
Split `App.tsx` into step components. Step 1 login (`api.ts`). Step 2, the **image uploader**: drop zone for files and folders
(`<input type=file multiple accept="image/*,video/mp4,video/webm">` and `webkitdirectory`), calls `addToLibrary` with a progress bar,
then shows the library as a grid/table: thumbnail (the `url`), file name with a **copy `media:<fileName>`** button, size, dimensions,
"already in the store" badge for `duplicate`, a remove-from-library button (library only, nothing is deleted in the store), failures with
the store's message (too large, not an image). Persist with `saveLibrary` (already done inside `addToLibrary`; call it after removals).
The user can come back to this step at any time.

## 4b. UI: choose files
Per template a drop zone (`.json/.yaml/.yml/.csv`), buttons
"Download example (json/yaml/csv)" and a collapsible rendering of the template README (`templates/files.ts`; render markdown
with `marked` + `dompurify` like the store admin, or show preformatted text first). Catch `AdapterError` and show its message with the line.

## 5. UI: check
Run `validateDocument` on each loaded file with a context built from the other loaded files (`pending`), the store index
(`existing`) and the library (`libraryNames(library)` → `images`). Show issues grouped by file → row identifier → field, errors red, warnings amber.
Re-run automatically when a file is replaced. Buttons: "Import valid rows only" / disabled when there are errors and "stop on error" is chosen.

## 6. UI: import + report
`buildPlan` → `runPlan` with live progress (a table: operation label, status, store message), a cancel button, and
"Download report" (the `RunReport` JSON). Show totals: created / updated / skipped / failed / blocked.

## 7. Nice to have
* Attributes template (`POST /api/v1/attributes`, `CreateAttributeDto`: `code,name,type,isVariantLevel,sortOrder`) and product attribute values.
* Image library extras: alt text per image, rename, "which records use this image", a `GET /api/v1/media`-based view of what products already use.
* "Download template" for a *filled* export of what the store has (round trip), via the same adapters.
* Dry run mode: build the plan and show it without sending.
* French UI (the store admin keeps French texts in `admin/src/i18n/fr.ts`; same approach).
* CSV nested columns (`contentBlocks.1.type`) if users ask for content blocks in CSV.
* Playwright smoke test of the four steps.

## Conventions
TypeScript strict, no `any`, 2-space indentation (Vite default). Comments explain *why*, short. Template changes always
update, together: the schema, the three example files, the template `README.md`, and the registry entry. The
`examples.test.ts` test fails if the three example formats disagree or stop validating.
