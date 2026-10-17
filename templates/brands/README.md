# Brands

| Column | Required | Example | Rule |
|---|---|---|---|
| `slug` | yes, **identifier** | `acme` | as for tags |
| `name` | yes | `Acme Jewels` | |
| `website` | no | `https://acme.example` | |
| `country` | no | `TN` | free text |
| `logoUrl` | no | `media:acme-logo.png` | square (1:1) picture: `https://…` or `media:<fileName>` of an image in the image library |

Store API: `POST /api/v1/brands`. Brands can be defined upfront in this file, or auto-created on the fly directly in product rows by prefixing with `create:` (e.g. `brand: "create:acme"`).
