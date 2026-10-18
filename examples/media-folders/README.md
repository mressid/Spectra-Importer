# Media folder examples

Four ready-to-drop folders for the **Images** step of the importer. Each one is a different way of laying out photos;
the folder names tell the importer where every photo goes, so there is nothing to type per image.

| Folder | Shows | Photos | Bindings |
|---|---|---|---|
| [01-one-place-per-folder](01-one-place-per-folder/README.md) | The basic layout: `kind/name/slot/` | 6 | 6 |
| [02-one-photo-many-places](02-one-photo-many-places/README.md) | One photo for several products, categories or variants | 4 | 8 |
| [03-gallery-order-and-ratio](03-gallery-order-and-ratio/README.md) | Gallery order by folder, file name or per place; aspect-ratio folders | 8 | 9 |
| [04-whole-shop](04-whole-shop/README.md) | Everything together, as you would lay out a real catalogue | 11 | 12 |

## Try one

1. Open the importer, go to **Images**, drop one of the four folders (or press *Select Structured Folder*).
2. The preview lists every photo with its bindings. Press **Sync Bindings to Store**.
3. A place that exists in the store is filled at once (`APPLIED`). One that does not is reserved (`WAITING`) and is
   filled when it is created, so the order *photos first, data later* works. The names here (`solitaire-gold`, `rings`...)
   do not exist in a fresh store, so you will see `WAITING`.

To lay out your own: press **Download Folder Template** on the same step. It builds the empty folders from your loaded files.

## The rules in one table

| Folder | Becomes |
|---|---|
| `product/<slug>/` `variant/<sku>/` `category/<slug>/` `brand/<slug>/` | the place (by slug, or SKU for variants) |
| `thumbnail/` | the one main image (role `THUMBNAIL`, order 1) |
| `gallery/` | one of several (role `GALLERY`) |
| `[a, b]/` | the same photo for several products |
| `variant[x, y]/` | several places of one kind |
| `[product=a, category=b]/` | several places of mixed kinds |
| `1/`, `order-3/`, a file named `02_back.png`, or `[a@1, b@3]/` | the order in a gallery |
| `4x5/`, `16x9/` | the aspect ratio, shown in the preview only (it is not stored in the shop) |

## What the shop accepts

The shop's media library only knows two roles, and each kind of place takes some of them. A wrong combination is
rejected by the store and **undoes all bindings of that photo**.

| Place | `thumbnail/` | `gallery/` |
|---|---|---|
| product | yes | yes |
| variant | **no** | yes |
| category | yes (its image) | **no** |
| brand | yes (its logo) | **no** |

Limits: images up to 5 MB (JPEG, PNG, WebP, GIF, AVIF), videos up to 50 MB (MP4, WebM). A thumbnail must be an image.

## Good to know

* **Works on Windows, macOS and Linux.** Folder names use only letters, digits and `- _ [ ] , = @`; the characters
  Windows refuses (`: * ? " < > | \`) are never needed. A test fails if an example ever uses one.
  The older spelling (`*:[a, b]`, `product:a`, `ring-a:3`, `16:9/`) is still read, but cannot be created on Windows.
* **Number the gallery files** (`01_`, `02_`...). Without a number the order follows the order the browser lists the
  files, which is not guaranteed to be alphabetical.
* Other files in a dropped folder (like these README files) are ignored; only images and videos are uploaded.
* The same photo (same bytes) is stored once. Dropping a folder twice is harmless.
* The example photos are 200 px flat-colour squares, only there to be dropped.
* `npm test` reads these folders (`src/upload/mediaExamples.test.ts`) and fails if what a README promises stops being true.
