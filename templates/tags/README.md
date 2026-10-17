# Tags

Labels attached to products ("New arrival"). Used by homepage sections and filters.

| Column | Required | Example | Rule |
|---|---|---|---|
| `slug` | yes, **identifier** | `new-arrival` | lower case letters, digits, dashes; unique in the file and in the store |
| `name` | yes | `New arrival` | shown to customers |

Store API: `POST /api/v1/tags`. Upload this file **before** products that use these tags.
