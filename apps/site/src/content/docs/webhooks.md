---
title: "Webhook destinations and signature verification"
description: "How Postbag delivers to webhook destinations: the JSON payload, Postbag-Signature (t=…,v1=… HMAC-SHA256), Postbag-Delivery and Postbag-Event headers, retry and dead-letter behaviour, and verification code in Node.js, Python and Go."
order: 21
section: Guides
---

A webhook destination is a URL, an optional secret and optional extra headers. It is the universal extension point: CRMs, automation tools, your own services.

## The request

```http
POST https://crm.example.com/postbag
Content-Type: application/json
Postbag-Delivery: dl_a91x02
Postbag-Event: submission.received
Postbag-Signature: t=1724200000,v1=5f1c…e9a2

{ "id": "dl_a91x02", "type": "submission.received", "schema_version": 3,
  "stream": { "id": "st_…", "slug": "vending-leads" } | null,
  "form":   { "id": "fm_…", "slug": "kontorsautomat-contact" },
  "data":   { …mapped payload… }, "meta": { … } }
```

`Postbag-Event` is `submission.received` for instant routes and `digest.ready` for digest routes (one payload per period containing the period's submissions).

## Response handling

| Your response | Postbag does |
|---|---|
| `2xx` | Marks the delivery `sent`, stores status, latency and a body excerpt. |
| `410` | Treats the destination as having disabled itself; no retry. |
| anything else, or a timeout (10 s) | Marks `failed`, schedules a retry with backoff `min(2^attempts × 30 s ± 20 %, 6 h)`, up to 10 attempts, then `dead` and raises `delivery.dead`. |

Dead deliveries keep their payload and can be retried from the dashboard or `POST /v1/deliveries/{id}/retry`.

## Verifying the signature

The signature is `HMAC-SHA256(secret, "{t}.{rawBody}")` in hex. Always verify over the **raw** body bytes, compare in constant time, and reject stale timestamps.

### Node.js

```ts
import { createHmac, timingSafeEqual } from "node:crypto"

export function verifyPostbag(secret: string, header: string, rawBody: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]))
  const t = Number(parts.t)
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")
  const given = parts.v1 ?? ""
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given))
}
```

### Python

```python
import hmac, hashlib, time

def verify_postbag(secret: str, header: str, raw_body: bytes, tolerance=300) -> bool:
    parts = dict(kv.split("=", 1) for kv in header.split(","))
    t = int(parts.get("t", "0"))
    if abs(time.time() - t) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))
```

### Go

```go
func verifyPostbag(secret, header string, rawBody []byte, tolerance time.Duration) bool {
    parts := map[string]string{}
    for _, kv := range strings.Split(header, ",") {
        p := strings.SplitN(kv, "=", 2); if len(p) == 2 { parts[p[0]] = p[1] }
    }
    t, err := strconv.ParseInt(parts["t"], 10, 64)
    if err != nil || time.Since(time.Unix(t, 0)).Abs() > tolerance { return false }
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(strconv.FormatInt(t, 10) + ".")); mac.Write(rawBody)
    return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(parts["v1"]))
}
```

## Organization system webhooks

Separate from route destinations, `POST /v1/webhooks { url, events[], secret? }` subscribes to organization events (`submission.received`, `delivery.dead`, `form.schema.changed`, `stream.schema.changed`, `drift.detected`, `destination.failing`, …). Dispatch is triggered from Postgres; deliveries are listed at `GET /v1/webhooks/{id}/deliveries` and signed the same way when a secret is configured.
