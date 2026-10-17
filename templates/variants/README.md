# Variants (options of a product)

One row per purchasable option. Only for products with `hasVariants = true` (simple products already have theirs).

| Column | Required | Example | Rule |
|---|---|---|---|
| `sku` | yes, **identifier** | `BRACELET-S` | unique in the file and in the store |
| `product` | yes | `silver-bracelet` | slug of the product (this import or the store); it must have `hasVariants = true` |
| `name` | yes | `Small (16 cm)` | shown to customers |
| `price` | yes | `89.000` | dinars, at most 3 decimals |
| `compareAtPrice`, `barcode` | no | | |
| `weightGrams`, `stockQuantity`, `safetyStock` | no | | whole numbers ≥ 0; empty stock = not tracked |
| `availability`, `leadTimeDays`, `isActive` | no | `AUTO` | as for products |

Store API: `POST /api/v1/variants` (the importer sends `productId` after looking the slug up).
Upload **after** products.
