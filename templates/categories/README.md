# Categories

| Column | Required | Example | Rule |
|---|---|---|---|
| `slug` | yes, **identifier** | `rings` | |
| `name` | yes | `Rings` | |
| `parent` | no | `rings` | slug of the parent category; empty = top level. Prefix with `create:` (e.g. `create:jewelry`) to auto-create parent category. Otherwise parent must exist in this file or store. Parents are created before children (the planner sorts them) |
| `sortOrder` | no | `1` | whole number ≥ 0 |
| `isActive` | no | `true` | `true/false/yes/no/1/0` |
| `seoTitle` | no | | up to 70 characters |
| `seoDescription` | no | | up to 160 characters |
| `imageUrl` | no | `media:rings-cover.jpg` | 4:3 picture, `https://…` or `media:<fileName>` (image library) |

Store API: `POST /api/v1/categories` (the importer sends `parentId` after looking the parent slug up).
