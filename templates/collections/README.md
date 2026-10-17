# Collections

Seasonal selections of products, optionally limited in time.

| Column | Required | Example | Rule |
|---|---|---|---|
| `slug` | yes, **identifier** | `winter-2026` | |
| `name` | yes | `Winter 2026` | |
| `description` | no | | |
| `startAt`, `endAt` | no | `2026-12-01T00:00:00` | ISO date-time without time zone (store time). Quote it in YAML |
| `isActive` | no | `true` | |

Store API: `POST /api/v1/collections`.
