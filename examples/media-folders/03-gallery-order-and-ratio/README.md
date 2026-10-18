# 03 · Gallery order and aspect ratio

Three ways to say where a photo sits in a gallery, plus an aspect-ratio folder.

```
03-gallery-order-and-ratio/
├── product/ring-a/
│   ├── thumbnail/cover.png
│   └── gallery/
│       ├── 1/front.png                  order from a number folder
│       ├── 2/back.png
│       └── order-3/angle.png            "order-3", "pos-3", "seq_3" work too
├── product/ring-b/
│   ├── thumbnail/cover.png
│   └── 4x5/gallery/                     aspect ratio folder (4x5, 16x9, ratio-1x1...)
│       ├── 01_on-model.png              order from the file name prefix
│       └── 02_on-hand.png
└── [ring-a@4, ring-b@3]/
    └── gallery/macro.png                position per place, after the @
```

## What the importer binds

| Photo | Place | Slot |
|---|---|---|
| `front.png` | `ring-a` | GALLERY #1 |
| `back.png` | `ring-a` | GALLERY #2 |
| `angle.png` | `ring-a` | GALLERY #3 |
| `macro.png` | `ring-a` | GALLERY #4 |
| `01_on-model.png` | `ring-b` | GALLERY #1 |
| `02_on-hand.png` | `ring-b` | GALLERY #2 |
| `macro.png` | `ring-b` | GALLERY #3 |
| both `cover.png` | `ring-a`, `ring-b` | THUMBNAIL |

The shared `macro.png` sits at position 4 in `ring-a` and 3 in `ring-b`.

## Order, from strongest to weakest

1. `name@order` inside `[...]` (`ring-a@4`; the older `ring-a:4` still works)
2. a number folder or `order-N` folder in the path
3. a number at the start of the file name (`01_`, `2-`, `03.`) or its end (`front_01`), or a name that is only a number (`1.png`)
4. no number: counting up 1, 2, 3... in the order the browser lists the files (so number your files)

A thumbnail is always order 1. A slot holds one photo: binding another photo to the same place, role and order
replaces the first.

## Aspect ratio

`4x5`, `16x9`, `ratio-1x1` folders (`4:5` is read too, but Windows cannot create it) (also detected from the pixel size when there is no folder) are shown in the
preview so you can check a batch is consistent. **The ratio is not stored in the shop**; it is a check, not a setting.
Here the two `4x5` photos are 160 x 200 px, as the folder says.

## Use it for

Products with many shots where the sequence matters (front, back, detail), or a photo that is 2nd for one product and
5th for another.
