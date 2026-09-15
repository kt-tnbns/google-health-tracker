# Release 2.2.0 — bounded automatic synchronization

## Contract
- Hourly server synchronization of today and yesterday; seven-day reconciliation once per local day.
- Opening or returning to the app displays cached data first, then requests refresh if the last fully successful refresh is older than 15 minutes.
- Manual fetch remains available. All ingest refresh paths share a PostgreSQL advisory lock; skipped requests do not claim successful freshness.
- Failed/partial attempts do not advance successful freshness; automated attempts have a cooldown to avoid refresh loops.
- Bounded Google retries for 429/transient failures, honoring Retry-After, with request pacing.
- Reuse identical successful raw responses. Delete only unreferenced raw responses older than 30 days; retain latest diagnostics per data type.
- Track sync runs and database size, with bounded history. Do not invoke AI on automated refresh.
- Commit on release/2.2.0 and open a detailed PR against main; do not deploy or merge.

## Implementation
1. Add durable sync state/run records and advisory-lock wrapper around IngestService.refresh. Test contention, success, partial failure, cooldown, and lock release.
2. Add lifecycle-managed scheduler plus guarded status/ensure endpoints. Route app-open/visibility triggers through ensure; manual refresh uses two days.
3. Add raw storage deduplication and retention service/migration; test preservation of referenced records and duplicate reuse in real PostgreSQL.
4. Add paced retry transport and fake-timer tests for retry limits and response handling.
5. Document configuration, retention tradeoffs, database observations and rollout; run all tests against temporary PostgreSQL plus build/typecheck, review, commit and PR.
