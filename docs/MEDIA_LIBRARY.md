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

### A. Wildcard & Multi-Name Syntax (`*:[]`)
A single image file can be bound to multiple products, categories, or variants simultaneously:

| Folder Path | Target(s) | Logical Name(s) | Role | Order |
|---|---|---|---|---|
| `*:[ring-a, ring-b]/thumbnail.jpg` | `product` | `ring-a`, `ring-b` | `THUMBNAIL` | 1 |
| `product:[ring-a, ring-b]/gallery/01.jpg` | `product` | `ring-a`, `ring-b` | `GALLERY` | 1 |
| `*:[product:ring-a, category:rings]/thumbnail.jpg` | `product`, `category` | `ring-a`, `rings` | `THUMBNAIL` | 1 |
| `[var-1, var-2]/thumbnail.png` | default target | `var-1`, `var-2` | `THUMBNAIL` | 1 |

### B. Path-Bound Individual Ordering
Each binding can specify its own position/order in a gallery:
- **Per-slug order in wildcard segment:**
  ```
  *:[ring-a:1, ring-b:3]/gallery/macro.jpg
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
- **Sequential fallback:** Assets in a gallery without explicit numbers are assigned sequential orders (`1, 2, 3...`) in alphabetical order.

### C. Roles
The parser extracts roles from folder segments or file names:
- **`THUMBNAIL`**: Main hero/cover image. Triggered by `thumbnail`, `thumb`, `cover`, `main`, `hero`.
- **`GALLERY`**: Additional product shots. Triggered by `gallery`, `images`, `photos`, `slides`.
- **`BANNER`**: Wide hero or category headers. Triggered by `banner`, `header`.
- **`LOGO`**: Brand or category logos/icons. Triggered by `logo`, `icon`, `avatar`.
- **`SWATCH`**: Color or material variant preview. Triggered by `swatch`, `color`.

### D. Aspect Ratios
Aspect ratios are detected both from folder paths and calculated from media dimensions:

- **Path-specified aspect ratios:**
  ```
  product/ring-a/1:1/thumbnail.jpg           --> explicit aspect ratio: "1:1"
  product/ring-a/4:5/gallery/01_model.jpg    --> explicit aspect ratio: "4:5"
  category/rings/16:9/banner.jpg             --> explicit aspect ratio: "16:9"
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
├── *:[solitaire-gold, solitaire-silver]/
│   ├── 1:1/
│   │   └── thumbnail.jpg                    # Bound to both products as THUMBNAIL (order 1)
│   └── 4:5/
│       └── gallery/
│           ├── 01_model_look.jpg            # Bound to both products as GALLERY (order 1)
│           └── 02_packaging.jpg             # Bound to both products as GALLERY (order 2)
├── category/
│   └── rings/
│       ├── 1:1/thumbnail.jpg                # category: rings (THUMBNAIL)
│       └── 16:9/banner/hero.jpg             # category: rings (BANNER)
├── brand/
│   └── aurum/
│       └── logo.png                         # brand: aurum (LOGO)
└── solitaire-gold/
    └── variants/
        ├── size-52/01_macro.jpg             # variant: size-52 (GALLERY, order 1)
        └── size-54/01_macro.jpg             # variant: size-54 (GALLERY, order 1)
```

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
    "data": [
      {
        "uploadedFileId": "upl_9f82a1c",
        "target": "product",
        "name": "solitaire-gold",
        "role": "THUMBNAIL",
        "order": 1,
        "status": "APPLIED"
      },
      {
        "uploadedFileId": "upl_9f82a1c",
        "target": "product",
        "name": "solitaire-silver",
        "role": "THUMBNAIL",
        "order": 1,
        "status": "WAITING"
      }
    ]
  }
  ```

---

## 5. UI Features in the Importer (`src/ui/StepImages.tsx`)

1. **Structured Folder Dropzone:** Accepts drag-and-drop folders (via `webkitGetAsEntry`) or directory picker dialogs.
2. **Real-Time Parser Preview:**
   - Displays summary badges for target entities (`product: N`, `variant: N`, `category: N`, `brand: N`).
   - Highlights multi-bound assets (`*:[...]`).
   - Displays individual cards for every detected asset showing its bindings, extracted alt text, and aspect ratio.
3. **One-Click Store Synchronization:**
   - Click **"Sync Bindings to Store"** to execute `PUT /api/v1/admin/media/bindings` for all uploaded assets.
   - Shows live status badges:
     - `APPLIED` (green badge) for existing catalogue records.
     - `WAITING` (amber badge) for reserved slots held in `pending_media`.
4. **Copy `media:<fileName>`:** Every image in the library card grid provides a copy button to easily reference files in JSON, YAML, or CSV import templates.
