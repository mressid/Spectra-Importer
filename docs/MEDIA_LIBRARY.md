# Media Library & Folder Structure Importer

The Store Importer Media Library manages the upload, storage, aspect ratio classification, and entity bindings of images and videos. It communicates with the store backend (`accessories-store-system`) to upload assets and bind them to catalogue entities **before or after those entities exist**.

---

## 1. Core Philosophy: Names, Not IDs

Traditional ecommerce systems require you to create a product, variant, or category first to obtain its database ID, and only then upload images to attach to it.

The Media Library reverses this workflow:
- A binding destination is defined by a **target type** (`product`, `variant`, `category`, `brand`) plus a **logical name** (`slug`, `sku`): e.g. `product` + `solitaire-ring`, `variant` + `SKU-GOLD-01`, `category` + `rings`.
- An asset can be uploaded and bound **before** the row exists in the store database.
- **Existing target:** the slot is applied immediately &rarr; `"status": "APPLIED"`.
- **Missing target:** the slot is reserved in `pending_media` &rarr; `"status": "WAITING"`. When the store creates the product or category, `pendingMediaService.take(target, slug)` automatically claims all reserved media.

---

## 2. Folder Structure Conventions

The folder structure is the **single source of truth** for media organization. File names remain clean and descriptive; metadata (targets, roles, individual orders, aspect ratios) is encoded in the folder hierarchy.

> **Portable on every OS.** Folder names use only letters, digits and `- _ [ ] , = @`. Windows refuses `: * ? " < > | \`,
> so the earlier spellings `*:[a, b]`, `product:[a, b]`, `ring-a:3` and `16:9/` are no longer the documented form. The
> importer still reads them (for folders made on macOS/Linux), but **Download Folder Template** and the examples never use them.
> Equivalents: `*:[a, b]` &rarr; `[a, b]` &middot; `product:[a, b]` &rarr; `product[a, b]` &middot; `product:ring-a` &rarr; `product=ring-a` &middot; `ring-a:3` &rarr; `ring-a@3` &middot; `16:9/` &rarr; `16x9/`.

### A. Multi-Name Syntax (`[a, b]`)
A single image file can be bound to multiple products, categories, or variants simultaneously:

| Folder Path | Target(s) | Logical Name(s) | Role | Order |
|---|---|---|---|---|
| `[ring-a, ring-b]/thumbnail.jpg` | `product` | `ring-a`, `ring-b` | `THUMBNAIL` | 1 |
| `product[ring-a, ring-b]/gallery/01.jpg` | `product` | `ring-a`, `ring-b` | `GALLERY` | 1 |
| `[product=ring-a, category=rings]/thumbnail.jpg` | `product`, `category` | `ring-a`, `rings` | `THUMBNAIL` | 1 |
| `[var-1, var-2]/thumbnail.png` | default target | `var-1`, `var-2` | `THUMBNAIL` | 1 |

### B. Path-Bound Individual Ordering
Each binding can specify its own position/order in a gallery:
- **Per-slug order in wildcard segment:**
  ```
  [ring-a@1, ring-b@3]/gallery/macro.jpg
  ```
  *Asset bound to `ring-a` at order `1`, and to `ring-b` at order `3`.*

- **Numeric folder segments:**
  ```
  product/ring-a/gallery/1/front.jpg        --> order 1
  product/ring-a/gallery/2/back.jpg         --> order 2
  product/ring-a/gallery/order-3/angle.jpg  --> order 3
  ```

- **Numeric file prefixes/suffixes:**
  ```
  01_front.jpg   --> order 1
  02_back.jpg    --> order 2
  ring_03.jpg    --> order 3
  ```

- **Thumbnail rule:** Any asset identified as `THUMBNAIL` is automatically assigned order `1`.
- **Sequential fallback:** Assets in a gallery without explicit numbers take the lowest free position (`1, 2, 3...`) in path order, around positions that a folder, a file name or `[name@3]` already gave; the result does not depend on the order the browser lists the files in.

### C. Roles
The parser extracts roles from folder segments or file names:
- **`THUMBNAIL`**: the one main image (position 1). Triggered by `thumbnail`, `thumb`, `cover`, `main`, `hero`, `logo`, `icon`, `avatar`.
- **`GALLERY`**: one of several, in position order. Triggered by `gallery`, `images`, `photos`, `slides`, `banner`, `header`, `swatch`, `color`.

The store's media library knows exactly these two roles, so the folder words map to them. A product has both, a variant has a gallery
only, a category and a brand have a single image (`thumbnail/`, a brand's logo included). The review flags what does not fit, e.g. a
`banner/` folder on a category (a gallery it cannot have).

### D. Aspect Ratios
Aspect ratios are detected both from folder paths and calculated from media dimensions:

- **Path-specified aspect ratios:**
  ```
  product/ring-a/1x1/thumbnail.jpg           --> explicit aspect ratio: "1:1"
  product/ring-a/4x5/gallery/01_model.jpg    --> explicit aspect ratio: "4:5"
  category/rings/16x9/banner.jpg             --> explicit aspect ratio: "16:9"
  ```
  *(Supported delimiters: colon `1:1`, cross `4x5`, or prefix `ratio-16:9`)*

- **Calculated from dimensions (`calculateAspectRatio`):**
  Matches standard ecommerce ratios within a 2.5% tolerance:
  - `1:1` (Square, ratio 1.0) &mdash; Standard product cards, Instagram feed.
  - `4:5` (Portrait, ratio 0.8) &mdash; Fashion lookbook, mobile catalog.
  - `3:4` (Portrait, ratio 0.75) &mdash; Traditional apparel photography.
  - `16:9` (Landscape, ratio 1.778) &mdash; Hero banners, video embeds.
  - `9:16` (Vertical, ratio 0.5625) &mdash; Stories, mobile reels.
  - `21:9` (Ultrawide, ratio 2.333) &mdash; Wide cinematic banners.

### E. Alt Text Extraction
File names are automatically converted to clean alt text for accessibility and SEO:
- `01_front-view_diamond-ring.jpg` &rarr; `"Front view diamond ring"`
- `02_side-angle.png` &rarr; `"Side angle"`
- Generic terms (`thumbnail.jpg`, `image.png`, `01.jpg`) produce no redundant alt text.

---

## 3. Example Folder Layout

Here is a recommended drop layout demonstrating multi-binding, aspect ratio folders, and variant segregation:

```
my-catalogue-drop/
├── [solitaire-gold, solitaire-silver]/
│   ├── 1x1/
│   │   └── thumbnail.jpg                    # Bound to both products as THUMBNAIL (order 1)
│   └── 4x5/
│       └── gallery/
│           ├── 01_model_look.jpg            # Bound to both products as GALLERY (order 1)
│           └── 02_packaging.jpg             # Bound to both products as GALLERY (order 2)
├── category/
│   └── rings/
│       ├── 1x1/thumbnail.jpg                # category: rings (THUMBNAIL)
│       └── 16x9/banner/hero.jpg             # category: rings (a gallery image: the store refuses it, the review says so)
├── brand/
│   └── aurum/
│       └── logo.png                         # brand: aurum (THUMBNAIL: a brand's logo)
└── solitaire-gold/
    └── variants/
        ├── size-52/01_macro.jpg             # variant: size-52 (GALLERY, order 1)
        └── size-54/01_macro.jpg             # variant: size-54 (GALLERY, order 1)
```

### The fast way: download the skeleton, fill it, drop it back

Typing folder names by hand is the slow part. The Images step has a **Download Folder Template** dropdown (`src/ui/DownloadMenu.tsx`), every row with a download icon:

* **Empty folders (named after your loaded files)**: *Everything loaded*, or only *Products*, *Variants*, *Categories* or *Brands*
  (`src/upload/folderTemplate.ts`). Every row is always available: with no matching file loaded in the Files step you get an
  example layout (`example-product`, `EXAMPLE-SKU-01`...) to rename; with one loaded, the folders carry your own slugs and SKUs.
* **Data file templates (CSV)**: one per kind (products, variants, categories, brands). With pending images that no loaded file
  has a row for, it has one row per pending slug/SKU in the template's columns, so only the rest has to be filled in; otherwise
  it is a blank CSV with just the template columns.
* **Examples with sample photos**: the four combinations below, each a ZIP with its README (`src/upload/exampleCombos.ts`).

The first group builds `media-drop.zip`, with one empty folder per place:

```
media-drop/
├── product/<slug>/thumbnail/      main photo
├── product/<slug>/gallery/        01_front.jpg, 02_back.jpg ... (the number is the order)
├── variant/<sku>/gallery/
├── category/<slug>/thumbnail/
├── brand/<slug>/thumbnail/        the logo
└── README.txt                     the rules above, short
```

1. Load your products/variants/categories/brands files (Files step), come back to Images, download the template.
   With nothing loaded you get an example layout.
2. Unzip, copy the photos into the folders. File names are free; empty folders are ignored.
3. Drop the whole `media-drop` folder on the dropzone: every photo is uploaded and bound in one pass. Places that are not
   in the store yet are reserved (`WAITING`) and filled when they are created, so this can be done before the import.

Four ready-to-drop examples (one place per folder, one photo for many places, gallery order and ratio, a whole shop), each with its own README, are in [`examples/media-folders/`](../examples/media-folders/README.md).

Identifiers that cannot be folder names (`/`, `:`, `[`, `]`, `,`, `*`, `?`...) are left out and listed after the download;
rename those folders by hand or use the bracket syntax.

---

### Pending images (the main view)

Photos can be uploaded and bound *before* the product, variant, category or brand exists (status `WAITING`, held in
`pending_media`). The **Media Library** (Images step) opens on the list of these **pending images**: per place (slug or SKU)
the previews, its kind, how many images, and a badge: `row loaded` (a loaded data file has this name: importing it attaches the
images) or `no row` (a data file is missing or the name is mistyped). Filter by kind or search by name. It is read from
`GET /api/v1/admin/media/bindings/waiting` when you connect, and with *Refresh*.

**Uploading is in the right-hand panel** (open by default; *Hide upload panel* / *Show upload panel* in the toolbar toggles it, and the
choice is remembered; under 1280 px wide it moves below the list): the drop zone, upload progress, the detected bindings and the
uploaded library. **A folder or files can be dropped anywhere on the step** (the panel highlights the whole step), not only on the small
drop zone, and the browser never opens the dropped file instead.

**A drop is reviewed first.** Dropping (or picking) a folder opens **Review before uploading** above the pending list; nothing is sent
until you press *Upload*:

* each place the drop touches, with small previews of its photos (thumbnail, then gallery in position order), its kind and how many
  images, and whether it **already exists in the store** (the image is set at once) or **will be reserved** until it is created;
  a `row loaded` badge when a loaded data file has that name;
* a summary line (`12 files to upload, 15 bindings: 9 products, 2 variants…`, `8 already in the store, 4 reserved`);
* **what the store would refuse, with the reason**, before anything is uploaded: a variant thumbnail, a category or brand gallery,
  a thumbnail that is not an image, a file over 5 MB (images) or 50 MB (videos), a format the store does not take (SVG, BMP, MOV, OGG...).
  Those files are left out; a file with one refused binding is left out as a whole (the store applies all or nothing);
* warnings, e.g. two photos claiming one slot (only one stays);
* what is not a photo or video at all (README, data files), which is left out.

*Upload* then sends the files that are fine and binds each one **exactly as shown** (positions included), and the pending list refreshes
by itself. The checkbox *Review what a drop will do before uploading* in the panel turns the review off (the drop then uploads at once;
the choice is remembered). *Sync Bindings to Store* in the panel repeats the binding (after a place was created, or a refused binding was fixed).
The command line has the same check: `spectra media drop <folder> --dry-run`.

**Product folders and the Graph Builder.** After an upload the panel lists the **product folders** it found (the folder layout
`<product>/thumbnail.png`, `images/`, `variants/<v>/`, or the library layout `product/<slug>/thumbnail|gallery/`; a container folder
that only holds products is never listed as one, and the library's own `product/`, `brand/`, `[a, b]/` folders are not products). For each:

* **Auto-configure** adds the product, with a SKU (`<SLUG>-01`, or `<SLUG>-<VARIANT>` for each variant), a placeholder price and
  its photos (`media:<path>`), to the **rows** (the Files step) *and* to the **Graph Builder**, with the same SKU and images in both.
  Adding the same product again updates it; it never duplicates. **Auto-configure all** does every product.
* **Graph only** puts it in the graph without rows and without a placeholder price (the graph's checks say what is missing).

**Assemble in graph (pending images).** Each row of the pending images list has an **Assemble in graph** button (and
**Assemble all in graph** for what the filter shows). It puts the place the images are waiting for in the Graph Builder: a product
named by its slug (with a suggested SKU, ready for its price and the rest), or a variant, category or brand node. A product's images are
drawn as media nodes marked **Reserved**: they are already bound by name in the store and are attached when the product is created, so
the bundle does **not** write them into the product row again (that would attach them twice), and a product whose thumbnail is
reserved is not asked for one. A variant, category or brand image has no node in the graph; the store attaches it when the record is created.
A node can be switched between reserved and explicit in the inspector (*Already bound by name…*).

**Moving the metadata between rows and graph.** The graph is shared by the whole app (it is no longer lost when you leave the tab).
**Load rows** in the Graph Builder moves the rows that are loaded as files (products, variants, brands, categories, tags, collections,
including the data of a CSV, JSON or YAML file) into the graph: nodes with the same slug or SKU are updated, new ones are added below,
photos become media nodes, references become edges. Edit there, then **Compile & Bundle → Stage into Importer** moves the graph back
into the rows. The graph has no place for some row fields (`specifications`, `contentBlocks`…); Load rows says which, and they stay in
the rows. A sample graph that was never touched is replaced, not merged into.

Note: a dropped folder is also bound by name (the images wait for a product with that slug). Auto-configure then gives the product
its photos explicitly as well, so a gallery image can end up attached twice when the product is created; use one of the two for a folder.

**Problems are shown as toasts** (bottom right; errors stay 9 s, the rest 5 s, identical ones are merged as `×3`; dismiss with the
cross): nothing in the drop, no image or video among the dropped files (the message lists what it found, e.g. `.csv, .json, .yaml, .md`, says that data files belong in the Files step, and recognises folders the browser could not open), not connected to the store, a file or folder the browser could
not read, each upload the store refused (grouped by its message: "3 files were not uploaded: Image too large (a.png, b.png and 1 more)"),
each binding it refused, and a one-line result (`4 files uploaded`, `3 bindings applied now, 2 waiting…`). Large folders are read
completely (the browser returns a folder in batches of 100; every batch is read).

* The images are attached by the store when the row is created; no `media:` reference is needed in the data file.
* **A product row may leave `thumbnailUrl` empty when a thumbnail is waiting for its slug** (the store requires a thumbnail, and takes
  the reserved one). The check step knows this from the same list; without a waiting thumbnail, `thumbnailUrl` is still required.
* Variants are matched by SKU, categories and brands by slug.

---

## 4. Backend REST API Integration

### Upload File (`POST /api/v1/admin/uploads`)
Multipart file upload sending binary bytes to MinIO.
- **Request:** `FormData` with `file: Blob`.
- **Response:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "id": "upl_9f82a1c",
      "url": "http://localhost:9000/store/9f82a1c.webp",
      "mediaType": "IMAGE",
      "width": 1200,
      "height": 1500,
      "sizeBytes": 142080,
      "duplicate": false
    }
  }
  ```

### List waiting images (`GET /api/v1/admin/media/bindings/waiting`)
Every reservation whose place does not exist yet, ordered by kind, name and position; `?target=variant` keeps one kind.
Each entry: `target`, `name` (slug or SKU), `role`, `order`, `altText`, `uploadedFileId`, `url`, `mediaType`, `reservedAt`.

### Bind Media (`PUT /api/v1/admin/media/bindings`)
Associates an uploaded file with one or more named slots:
- **Request Body:**
  ```json
  {
    "uploadedFileId": "upl_9f82a1c",
    "bindings": [
      { "target": "product",  "name": "solitaire-gold",   "role": "THUMBNAIL" },
      { "target": "product",  "name": "solitaire-silver", "role": "THUMBNAIL" },
      { "target": "category", "name": "rings",            "role": "THUMBNAIL" }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "results": [
        { "target": "product", "name": "solitaire-gold",   "role": "THUMBNAIL", "order": 1, "status": "APPLIED" },
        { "target": "product", "name": "solitaire-silver", "role": "THUMBNAIL", "order": 1, "status": "WAITING" }
      ]
    }
  }
  ```

---

## 5. UI Features in the Importer (`src/ui/StepImages.tsx`, `PendingList.tsx`)

Main view: the pending images list (above). Everything below lives in the upload panel on the right.

1. **Structured Folder Dropzone:** Accepts drag-and-drop folders (via `webkitGetAsEntry`) or directory picker dialogs.
2. **Real-Time Parser Preview:**
   - Displays summary badges for target entities (`product: N`, `variant: N`, `category: N`, `brand: N`).
   - Highlights multi-bound assets (`[a, b]`).
   - Displays individual cards for every detected asset showing its bindings, extracted alt text, and aspect ratio.
3. **One-Click Store Synchronization:**
   - Click **"Sync Bindings to Store"** to execute `PUT /api/v1/admin/media/bindings` for all uploaded assets.
   - Shows live status badges:
     - `APPLIED` (green badge) for existing catalogue records.
     - `WAITING` (amber badge) for reserved slots held in `pending_media`.
4. **Copy `media:<fileName>`:** Every image in the library card grid provides a copy button to easily reference files in JSON, YAML, or CSV import templates.
