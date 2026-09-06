# Contributing

The most valuable contribution is a new detector — the agent ecosystem
changes weekly and geiger keeps up through small, data-driven modules.

## Adding a detector

1. Create `src/detectors/<ecosystem>.js` exporting `{ id, name, run(ctx) }`.
   `run` returns an array of findings (see `src/engine.js` for the shape)
   and must never throw for "not installed" — return `[]`.
2. Resolve paths through `src/platform.js` (respects `GEIGER_HOME` /
   `GEIGER_PLATFORM` for tests). Read files through `src/util/fsx.js`
   (never throws, tolerant JSON).
3. Scan any env/config material for credentials with `src/redact.js` —
   report shapes, never values.
4. Register it in `src/detectors/index.js`.
5. Add a fixture under `test/fixtures/` and assertions in
   `test/engine.test.js`. Run `npm test`.

Known-ID data (extension IDs, package names, browser-extension name hints)
lives in `data/known-agents.json` — additions there are the easiest PRs.

## Ground rules

- Zero runtime dependencies. No build step. Read-only. No network in the
  default path. These are product features; PRs that break them won't land.
- Plain language in findings. Exposure labels over severity theater.
