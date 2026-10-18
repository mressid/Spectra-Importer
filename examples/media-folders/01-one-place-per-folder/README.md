# 01 · One place per folder

The basic layout. The first folder is the **kind** of place, the second is its **name** (slug, or SKU for a variant),
the third is the **slot**.

```
01-one-place-per-folder/
├── product/solitaire-gold/
│   ├── thumbnail/front.png           main image
│   └── gallery/
│       ├── 01_side-view.png          gallery, position 1
│       └── 02_back.png               gallery, position 2
├── variant/SOLI-GOLD-52/
│   └── gallery/01_macro.png          variants have a gallery, no thumbnail
├── category/rings/thumbnail/rings.png
└── brand/aurum/thumbnail/aurum-logo.png    a brand's logo is its thumbnail
```

## What the importer binds

| Photo | Place | Slot |
|---|---|---|
| `front.png` | product `solitaire-gold` | THUMBNAIL |
| `01_side-view.png` | product `solitaire-gold` | GALLERY #1 |
| `02_back.png` | product `solitaire-gold` | GALLERY #2 |
| `01_macro.png` | variant `SOLI-GOLD-52` | GALLERY #1 |
| `rings.png` | category `rings` | THUMBNAIL |
| `aurum-logo.png` | brand `aurum` | THUMBNAIL |

The file name is free. For a gallery the leading number sets the position, and the rest becomes the alt text
(`01_side-view.png` &rarr; "Side view").

## Use it for

A shop where each product has its own photos. This is also what **Download Folder Template** produces, empty.
