# Products

Two kinds, same file:

* **Simple product** (`hasVariants` empty/false): one row; `sku` and `price` are required and become its single variant.
* **Product with options** (`hasVariants` = true): no `sku`/`price` here. Add one row per option in the **variants** file, pointing back with `product`.

| Column | Required | Example | Rule |
|---|---|---|---|
| `slug` | yes, **identifier** | `gold-ring` | |
| `name` | yes | `Gold ring` | |
| `thumbnailUrl` | yes, unless an image is already waiting for the slug | `media:ring-gold-1.jpg` | `https://…` or `media:<fileName>`: an image uploaded in the Images step, named exactly as the file |
| `images` | no | `media:a.jpg\|media:b.jpg` | more photos, in display order (the gallery); same kind of values; JSON/YAML use a list |
| `brand` | no | `acme` | slug of a brand. Prefix with `create:` (e.g. `create:acme`) to auto-create if not already in store |
| `categories`, `tags`, `collections` | no | `rings\|engagement-rings` | slugs; CSV separates with `\|`, JSON/YAML use lists. Prefix with `create:` (e.g. `create:rings`) to auto-create if not defined. Unknown unprefixed slug = error |
| `shortDescription` | no | | up to 500 characters |
| `description` | no | | up to 50 000 characters; format below |
| `descriptionFormat` | no | `MARKDOWN` | `MARKDOWN` (default), `HTML`, `TEXT` |
| `seoTitle` / `seoDescription` | no | | up to 70 / 160 characters |
| `specifications` | no | `Material: gold \| Weight: 4 g` | CSV: `Name: value` pairs separated by `\|`; JSON/YAML: `[{name, value}]`; at most 50 |
| `contentBlocks` | no | see JSON example | **JSON/YAML only**; `TEXT` needs `content`, `IMAGE`/`VIDEO` need `url` (`media:<fileName>` allowed); at most 50 |
| `isActive` | no | `true` | default true |
| `allowPersonalization`, `personalizationInstructions` | no | | engraving etc. |
| `hasVariants` | no | `false` | see above |
| `sku` | simple only | `RING-GOLD` | |
| `barcode` | no | | |
| `price` | simple only | `320.500` | dinars, at most 3 decimals |
| `compareAtPrice` | no | `380` | crossed-out price |
| `weightGrams` | no | `4` | |
| `stockQuantity` | no | `12` | empty = stock not tracked |
| `availability` | no | `AUTO` | `AUTO`, `ON_ORDER`, `SOLD_OUT` |
| `leadTimeDays` | no | `2` | 1–90, only with `ON_ORDER` |

Store API: `POST /api/v1/products`, then `POST /products/{id}/categories/{categoryId}` (and `/tags/`, `/collections/`) for each link, and `PUT /products/{id}/specifications`.
