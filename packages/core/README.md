# @postbag/core

Pure, deterministic domain logic for submissions, schemas, mappings, routing, spam,
backoff, webhook signing, and templates. This package performs no I/O.

## Deterministic policy seams

Spam scoring uses fixed additive thresholds: a filled honeypot is immediately `1`; at
least two links with link/word density of 15% adds `0.25`; text over 10,000 characters
adds `0.2`; a built-in disposable email domain adds `0.35`; at least 20 letters with 70%
uppercase adds `0.2`; and eight repeated characters adds `0.2`. Scores are capped at `1`.

Digest routing intentionally supports only daily `minute hour * * *` and weekly
`minute hour * * weekday` cron expressions, where weekday is `0` (Sunday) through `6`.
The period key names the most recent scheduled boundary in the route timezone. Other cron
forms fail with `validation_failed`; broad cron support belongs in a later phase.

The inference heuristic recognizes URL-shaped fields, but emits the contract's `text`
widget because `api/openapi.yaml` does not define a `url` widget value.
