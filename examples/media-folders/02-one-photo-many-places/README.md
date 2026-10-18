# 02 · One photo, many places

When the same photo belongs to several products, categories or variants, put it **once** in a folder whose name lists
the places. The photo is uploaded once and bound to each of them.

```
02-one-photo-many-places/
├── [solitaire-gold, solitaire-silver]/
│   ├── thumbnail/studio-shot.png         thumbnail of both products
│   └── gallery/01_gift-box.png           gallery #1 of both products
├── [product=solitaire-gold, category=rings]/
│   └── thumbnail/rings-hero.png          a product AND a category (kinds mixed)
└── variant[SOLI-GOLD-52, SOLI-GOLD-54]/
    └── gallery/01_size-chart.png         gallery #1 of two variants
```

## What the importer binds

| Photo | Places | Slot |
|---|---|---|
| `studio-shot.png` | product `solitaire-gold`, product `solitaire-silver` | THUMBNAIL |
| `01_gift-box.png` | product `solitaire-gold`, product `solitaire-silver` | GALLERY #1 |
| `rings-hero.png` | product `solitaire-gold`, category `rings` | THUMBNAIL |
| `01_size-chart.png` | variant `SOLI-GOLD-52`, variant `SOLI-GOLD-54` | GALLERY #1 |

Note `solitaire-gold` gets **two** thumbnails here (`studio-shot.png` and `rings-hero.png`): a place has one thumbnail
slot, so the store keeps the one bound last. Keep each place's thumbnail in one folder in real use.

## Syntax

| Folder name | Meaning |
|---|---|
| `[a, b]` | kind not given: product |
| `[product=a, category=b]` | each entry names its kind with `=` |
| `variant[x, y]` | every entry is of that kind |

Separate names with a comma; spaces after it are fine. Names must not contain `,` `[` `]` `=` `@`.
Only characters valid in a folder name on every OS are used. The older `*:[a, b]` and `variant:[x, y]` are still read.

## Use it for

Packaging shots, size charts, lifestyle photos, anything shared by a family of products. Faster than copying the file
into every product folder, and the store keeps a single copy either way.
