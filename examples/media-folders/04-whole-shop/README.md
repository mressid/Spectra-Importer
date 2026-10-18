# 04 · The whole shop in one drop

Everything from the other three, as you would lay out a real catalogue: brand logo, categories, products with
galleries, variants, and a shared photo. One drop uploads and binds all 11 photos.

```
04-whole-shop/
├── brand/aurum/thumbnail/aurum-logo.png
├── category/
│   ├── rings/thumbnail/rings.png
│   └── necklaces/thumbnail/necklaces.png
├── product/
│   ├── solitaire-gold/
│   │   ├── thumbnail/cover.png
│   │   └── gallery/01_front.png, 02_side.png
│   └── solitaire-silver/
│       ├── thumbnail/cover.png
│       └── gallery/01_front.png
├── variant/
│   ├── SOLI-GOLD-52/gallery/01_size-52.png
│   └── SOLI-GOLD-54/gallery/01_size-54.png
└── [solitaire-gold, solitaire-silver]/gallery/03_packaging.png     shared, position 3
```

## What the importer binds (12 bindings from 11 photos)

| Place | Slot | Photo |
|---|---|---|
| brand `aurum` | THUMBNAIL | `aurum-logo.png` |
| category `rings` | THUMBNAIL | `rings.png` |
| category `necklaces` | THUMBNAIL | `necklaces.png` |
| product `solitaire-gold` | THUMBNAIL | `cover.png` |
| product `solitaire-gold` | GALLERY #1, #2, #3 | `01_front`, `02_side`, `03_packaging` |
| product `solitaire-silver` | THUMBNAIL | `cover.png` |
| product `solitaire-silver` | GALLERY #1, #3 | `01_front`, `03_packaging` |
| variant `SOLI-GOLD-52` | GALLERY #1 | `01_size-52.png` |
| variant `SOLI-GOLD-54` | GALLERY #1 | `01_size-54.png` |

`solitaire-silver` has no position 2: gaps are fine, positions only have to be unique.

## Photos first, data later

None of these places has to exist yet. Each binding to a missing place is reserved (`WAITING`) and filled when the
place is created, in the same step that creates it. So the order is free:

1. Drop this folder, **Sync Bindings to Store**: all `WAITING`.
2. Import `brands`, `categories`, `products`, `variants` from the Files step. Each place picks up its photos as it is created.

A product created this way does not need a `thumbnailUrl` in its data file if a thumbnail was reserved.

## Use it for

The first load of a shop, or a photographer handing over one big folder.
