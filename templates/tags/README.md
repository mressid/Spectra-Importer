# Tags

Labels attached to products ("New arrival"). Used by homepage sections and filters.

| Column | Required | Example | Rule |
|---|---|---|---|
| `slug` | yes, **identifier** | `new-arrival` | lower case letters, digits, dashes; unique in the file and in the store |
| `name` | yes | `New arrival` | shown to customers |

Store API: `POST /api/v1/tags`. Tags can be defined upfront in this file, or auto-created on the fly directly in product rows by prefixing with `create:` (e.g. `tags: "create:new-arrival|create:sale"`).
