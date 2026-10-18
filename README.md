# Store importer

Load products and catalogue elements into the store from **JSON, YAML or CSV** files instead of typing them in the admin.

```
file (json | yaml | csv) → adapter → JSON rows → validation → upload to the store API
```

* Every row has an identifier (`slug`, `sku` or `key`); rows refer to each other with it.
* Images and videos are uploaded once in an image uploader; the tool keeps a library (file name → store URL) and data files
  refer to them as `media:<fileName>`.
* **Media Library & Folder Importer**: Supports directory structure upload with wildcard multi-entity bindings (`[slug-a, slug-b]`), individual path-bound orders, aspect ratio classification (`1x1`, `4x5`, `16x9` folders), and store binding synchronization (`PUT /api/v1/admin/media/bindings`), and a downloadable empty folder template built from your loaded files (fill it with photos, drop it back); see [docs/MEDIA_LIBRARY.md](docs/MEDIA_LIBRARY.md).
* Ready-made templates with documentation for each resource live in [`templates/`](templates): media, tags, brands,
  categories, collections, products, variants (no media file: images go through the uploader).

## Status
The entire pipeline (reading, templates, validation, media library & folder upload, store planning, execution, and visual Graph Builder canvas) is implemented and tested.
See [docs/TASKS.md](docs/TASKS.md). Design and rules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/MEDIA_LIBRARY.md](docs/MEDIA_LIBRARY.md).

## Run
```bash
npm install
npm run dev      # http://localhost:5174, /api proxied to http://localhost:8080 (STORE_API_URL to change)
npm test         # adapters, validation, media folder parser, every shipped example
npm run build
```

## Look
Colours, type and radii come from the store's shared design tokens (`accessories-store-system/design-tokens`), the same as the admin; see its README.
After cloning, `npm install` links them (the store repository must sit next to this project).

## Layout
```
docs/MEDIA_LIBRARY.md   media library folder structure upload & binding guide
templates/<resource>/   README.md (the column documentation) + example .json .yaml .csv
src/core/types.ts       the contracts between stages
src/adapters/           json, yaml, csv  →  ImportDocument
src/templates/          zod schema per resource, shared field helpers, registry
src/validate/           identifiers, schema, references, image names
src/upload/             API client + image library + media folder parser + plan + run
src/graph/              graph builder model, bundler & presets
src/ui/                 5-step import screen + workflow graph canvas
```
