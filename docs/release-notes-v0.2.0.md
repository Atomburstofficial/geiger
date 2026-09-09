# v0.2.0 — diff mode: the drift alarm

## New

- **`--diff baseline.json`** — compare a fresh scan against an earlier
  `--json` snapshot and see what **appeared**, **disappeared**, or
  **escalated** since then. A server that gained a credential shows as
  CHANGED, not as a remove/add pair.
- **Drift-gated `--strict`** — with a baseline, `--strict` exits 2 only on
  *new* findings that can execute code or hold secrets. The reviewed
  inventory stays quiet. Same mental model as a lockfile: accept what's
  there, alarm on change. Built for cron and CI.
- The drift section renders in the terminal report, the `--html` report,
  and is included in `--json` output for fleet tooling.
- **Sample reports in the repo** — [sample-report.html](sample-report.html)
  and [sample-report.json](sample-report.json), generated from the synthetic
  test fixture, so you can see exactly what to expect before running
  anything.

## Unchanged, on purpose

Read-only. No telemetry. Secrets by shape only, enforced by test. Zero
runtime dependencies. Baselines travel only where you put them.
