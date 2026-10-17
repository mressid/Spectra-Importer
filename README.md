# Store importer

Load products and catalogue elements into the store from **JSON, YAML or CSV** files instead of typing them in the admin.

```
file (json | yaml | csv) → adapter → JSON rows → validation → upload to the store API
```

* Every row has an identifier (`slug`, `sku` or `key`); rows refer to each other with it.
* Images and videos are uploaded once in an image uploader; the tool keeps a library (file name → store URL) and data files
  refer to them as `media:<fileName>`.
* Ready-made templates with documentation for each resource live in [`templates/`](templates): media, tags, brands,
  categories, collections, products, variants (no media file: images go through the uploader).

## Status
The reading, template, validation and image-library logic are done and tested. Planning, uploading and the screen are the next steps:
see [docs/TASKS.md](docs/TASKS.md). Design and rules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run
```bash
npm install
npm run dev      # http://localhost:5174, /api proxied to http://localhost:8080 (STORE_API_URL to change)
npm test         # adapters, validation, every shipped example
npm run build
```

## Look
Colours, type and radii come from the store's shared design tokens (`accessories-store-system/design-tokens`), the same as the admin; see its README.
After cloning, `npm install` links them (the store repository must sit next to this project).

## Layout
```
templates/<resource>/   README.md (the column documentation) + example .json .yaml .csv
src/core/types.ts       the contracts between stages
src/adapters/           json, yaml, csv  →  ImportDocument
src/templates/          zod schema per resource, shared field helpers, registry
src/validate/           identifiers, schema, references, image names
src/upload/             API client + image library (done), store index / plan / run (TODO)
src/ui/                 the screen (TODO)
```
