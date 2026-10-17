# Architecture

A browser tool that loads catalogue data from files and creates it in the store through the store's own REST API
(`accessories-store-system`, Spring Boot). No server of its own.

```
 products.csv ─┐
 brands.yaml  ─┼─ Adapter ──► ImportDocument ──► validateDocument ──► buildPlan ──► runPlan ──► RunReport
 tags.json    ─┘  (per format)   (data as JSON)    (Issue[], CleanRow[])  (Operation[])  (HTTP calls)
                                                          ▲                  ▲               │
                                   store index + image library ──────────────┘        store API (JWT)
                                                          ▲
 images / videos ── image uploader ── POST /admin/uploads ┘  (name → url, kept in the browser)
```

Each arrow is a pure TypeScript contract in [`src/core/types.ts`](../src/core/types.ts). A stage never looks at the
stage before the previous one. That is what lets a new format (an adapter) or a new template be added without
touching the rest.

## Stages and where they live

| # | Stage | Code | State |
|---|---|---|---|
| 1 | **Adapter**: text of a file → `ImportDocument` (`{template, version: 1, rows[]}`) | `src/adapters/` | done: json, yaml, csv |
| 2 | **Template**: schema of a row, identifier, dependencies, references | `src/templates/` | done: tags, brands, categories, collections, products, variants |
| 3 | **Validate**: identifiers, schema, references, `media:` names against the image library | `src/validate/validate.ts` | done, tested |
| 4 | **Store index**: what already exists (slug/sku → id) | `src/upload/storeIndex.ts` | done, tested |
| 5 | **Plan**: validated rows → ordered `Operation[]` | `src/upload/plan.ts` | done, tested |
| 6 | **Run**: send the operations, fill ids, report | `src/upload/run.ts` | done, tested |
| 7 | **UI**: 5-step page | `src/ui/` | done |
| – | **Image library**: upload images, keep name → url | `src/upload/imageLibrary.ts` | done (logic, tested, screen done) |
| – | API client (login, JSON request, file upload) | `src/upload/api.ts` | done |

## The rules that matter

### 1. Every row has an identifier
The `idField` of its template: `slug` (tags, brands, categories, collections, products) or `sku` (variants).
It is required, unique inside the file, and it is the *only* way rows are referred to: by other rows
(`product.brand = "acme"`), in error messages (`products "gold-ring": price is required`), in the run report, and to
recognise a record already in the store (re-running an import must not create duplicates).
Row numbers are shown too, but never used to link anything.

### 2. Heavy content is uploaded first and referenced by file name
Images and videos are never inside the data files, and there is no media CSV. Instead there is an **image uploader**
(the "Images" step): the user drops files or a folder, each is sent at once to `POST /api/v1/admin/uploads`, and the tool
keeps an **image library**: `fileName → url` (+ size, dimensions, `duplicate`), saved in the browser (`localStorage`) so it survives
a reload. The store itself only returns a URL and recognises an identical file by its SHA-256, so dropping the same
files again is harmless and gives the same URL.

Data files then say `media:<fileName>` in any picture field (`thumbnailUrl: media:ring-gold-1.jpg`, `images: media:a.jpg|media:b.jpg`,
`logoUrl`, `imageUrl`, content block `url`). The file name is the key, exactly as dropped (case-sensitive, with extension);
two files with the same name in one drop are refused. Validation fails for a `media:` name that is not in the library; the
planner replaces it with the library URL. Plain `https://…` addresses keep working. So no upload operation is ever part of
a plan: images are already in the store before the data is sent.
Limits enforced by the store: images up to 5 MB (resized), MP4/WebM videos up to 50 MB.

### 3. The schema is the single source of truth
One zod schema per template (`src/templates/schemas/`). It validates JSON/YAML values *and* coerces CSV strings, using
helpers in `src/templates/fields.ts` (`"a|b"` → list, `"12,5"` → 12.5, `"yes"` → true, empty cell → undefined). So the CSV
adapter knows nothing about templates, and the product CSV stays **flat** (no nested columns); the only JSON/YAML-only
field is `products.contentBlocks`.

### 4. Friendly rows ≠ API bodies
Rows use slugs (`brand: "acme"`, `parent: "rings"`); the API wants ids (`brandId`). The planner maps row → API call(s);
references are written as placeholders (`{brands:acme}`) and filled by the runner from ids returned earlier in the run
or found by `loadStoreIndex`.

References can point to already existing records in the store or staged import files. In addition, references can explicitly request on-the-fly resource creation using the `create:<slug>` prefix (e.g. `brand: "create:acme"`, `categories: ["create:rings"]`, `tags: ["create:sale"]`, `collections: ["create:summer-2026"]`, `parent: "create:jewelry"`). When prefixed with `create:`, the planner automatically generates and orders synthetic create operations for those resources if they are not already provided in the import files. Unprefixed references continue to require that the target exists beforehand.

| Template | Calls (in this order) |
|---|---|
| tags | `POST /api/v1/tags` `{slug,name}` |
| brands | `POST /api/v1/brands` `{slug,name,website,country,logoUrl}` |
| categories | `POST /api/v1/categories` `{slug,name,parentId,sortOrder,isActive,seoTitle,seoDescription,imageUrl}`; parents before children |
| collections | `POST /api/v1/collections` `{slug,name,description,startAt,endAt,isActive}` |
| products | `POST /api/v1/products` (`CreateProductDto`; simple product: `sku/price/barcode/compareAtPrice/weightGrams/stockQuantity/availability/leadTimeDays` go inside `defaultVariant`), then `POST /products/{id}/categories/{categoryId}`, `/tags/{tagId}`, `/collections/{collectionId}`, then `PUT /products/{id}/specifications` `[{name,value}]`, then one `POST /api/v1/media` `{productId,url,mediaType:"IMAGE",sortOrder}` per entry of `images` |
| variants | `POST /api/v1/variants` (`CreateVariantDto`, `productId` from the product slug) |

Authoritative DTOs: `accessories-store-system/src/main/kotlin/com/accessorise/store/features/*/dto/*.kt`.
Money has at most 3 decimals (TND millimes). The store may answer 400 with `errors: ["slug:already used"]`-style
field errors, 409 for duplicates, 429 on too many calls (login/checkout only), 401 when the 15-minute token expires.

### 5. Upload order
Images are uploaded before everything (the Images step). `RESOURCE_KINDS` in `core/types.ts` is the global order of the data: tags → brands → categories → collections → products → variants.
Inside a template, file order, except categories (parent first). An operation lists the keys it waits for in `after`.

### 6. Re-running is safe
Before creating, look the identifier up (`GET /api/v1/<resource>?slug=...`, list endpoints support `slug`; variants:
`?productId=` and `skuContains=`). `ConflictMode`: `skip` (default: report "already exists") or `update` (`PUT`).
Media has no lookup: the store deduplicates identical files itself (`duplicate: true` in the answer).

### 7. Failure handling
One failing row never stops the rest. Dependents of a failed row are `blocked` (not sent). Errors are shown with the
store's own message. The final `RunReport` is downloadable as JSON so a failed import can be fixed and re-run.

## Out of scope (for now)
Updating existing records from a diff, deleting, orders/customers/coupons, attributes/inventory levels, image editing,
a server component, multi-store.
