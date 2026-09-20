# Orders

## The Payload

Orders are the bridge between the game and the flowers API.
`POST /api/flower/order` (`api/flower/order.ts`) takes the session data and
returns the payload a programmatic order would carry:

```json
{
  "api_version": "v1",
  "order": {
    "session_id": 42,
    "arrangement": {
      "spec": {},
      "level": "bouquet",
      "flower_count": 10,
      "prompt": "sunset roses with baby's breath"
    },
    "metadata": {
      "generation": 3,
      "created_at": "2026-09-20T10:00:00.000Z"
    }
  }
}
```

The request body is `session_id`, `spec`, `arrangement_level` (the level
name), `flower_count`, `generation` and `prompt`. The handler copies them and
adds `api_version` and `created_at`. No model call.

## Order Flow

`client/src/orders/OrderFlow.tsx` shows the selected session (prompt, level,
flower count, generation) and a button. The button posts to
`/api/flower/order` with `spec: {}` and prints the returned JSON in the panel.

The `place_order(session_id, source, note)` reducer exists on the server. It
inserts a `flower_order` row, sets the session to `Ordered`, and increments the
user's `total_orders`. An `Ordered` session cannot be deleted. The client does
not call this reducer yet; the order flow ends at the payload.

## Order Feed

`client/src/orders/OrderFeed.tsx` lists the 20 most recent `flower_order` rows
from the subscription. It shows "no orders yet." until something calls
`place_order`.

## Not Implemented

There is no pricing, no XP and no fulfillment. Orders are not sent anywhere.
