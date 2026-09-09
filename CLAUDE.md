# CLAUDE.md — working context for geiger

Read this first. It captures what isn't obvious from the code. (This file is
public — project/business context lives elsewhere.)

## What this is

**geiger** — a Geiger counter for AI agents. One read-only command that
inventories every AI agent, harness, MCP server, plugin, and AI extension on
a machine and reports what each can touch. Published as `geiger-scan` on npm
(`npx geiger-scan`), MIT, from `github.com/Atomburstofficial/geiger`.

## Hard invariants (the product IS these — never trade them away)

1. **Read-only.** The only writes are the report files the user names
   (`--json`, `--html`). Never execute anything discovered (no npm, no
   binaries, nothing). Reads configs and directories only.
2. **No telemetry.** No endpoint exists. Do not add one, "just for counts."
3. **Secrets by shape only.** Report key name + file + shape, never any part
   of a value. `redact()` runs on every serialized output path as
   defense-in-depth, and `test/engine.test.js` has a REDACTION GUARANTEE
   test that enforces it. Any new output path must go through `redact()`.
4. **Zero runtime dependencies, no build step.** The source people read is
   the code that runs — that readability is the trust model. Keep modules
   small; a reader should manage the whole thing in one sitting.
5. **Never crash.** Detectors run inside try/catch in `engine.run()`;
   failures become `diagnostics` entries, never swallowed, never fatal.
   File readers in `util/fsx.js` never throw; `parseJsonTolerant` handles
   comments, trailing commas, and lone Windows backslashes (documented
   `\t`-ambiguity caveat).
6. **Honest labels.** Exposure labels (EXECUTES, HOLDS-SECRETS,
   BROAD-FILESYSTEM, BROAD-WEB, NETWORK, UNKNOWN-ORIGIN) claim only what a
   config proves. Partially-parseable formats (TOML, JetBrains XML) are
   shape-scanned and marked `medium`/`low` confidence rather than skipped
   or overclaimed. Limitations are stated in README, terminal footer, and
   HTML footer — keep them current.

## Architecture

- `bin/geiger.js` — CLI: flags `--help --json <f> --html <f> --strict
  --home <dir> --path <dir>` (repeatable) `--diff <baseline.json>`.
  With `--diff`, `--strict` gates on drift (new hot findings) only.
- `src/engine.js` — `run()` (detector loop), `finding()` normalizer,
  `assessMcpServer()` (ONE definition of what an MCP server entry means:
  wrapper-aware `--` split for policy agents, npx/docker/local-script
  origin tracing), `actionsFor()` (plain-language remediation).
- `src/detectors/` — one module per ecosystem, registered in `index.js`.
  Adding an ecosystem = one module + one line + a fixture + an assertion.
  `common.js#findingsFromMcpFile(file, detector, hostLabel, key)` for any
  JSON config holding MCP servers (key varies: `mcpServers`, `servers`,
  `context_servers`, `mcp`).
- `src/redact.js` — shape regexes, `classifyValue`, `scanEnvObject` (key-name
  heuristic), `scanText`, `redact()`.
- `src/platform.js` — all per-OS paths, honoring `GEIGER_HOME` /
  `GEIGER_PLATFORM` env for tests. Detectors stay platform-agnostic.
- `src/diff.js` — baseline comparison; identity = detector|kind|name|origin;
  escalation (gained exposure/credential) = CHANGED, not remove+add.
- `src/report/terminal.js` + `html.js` — both render the drift section;
  both pipe everything through `redact()`.
- `data/known-agents.json` — community-updatable IDs (VS Code extensions,
  npm globals, browser-extension name hints).

## Testing

- `npm test` (bare `node --test` — passing a dir breaks on Windows).
- Fixtures live in `test/fixtures/home1` (a fake home dir; detectors read it
  via `GEIGER_HOME` + `GEIGER_PLATFORM=win32`). `empty` fixture must keep
  yielding zero findings/diagnostics.
- Every new detector: fixture files + assertions in the fixture-home test.
- Dogfood after changes: `node bin/geiger.js` on the dev machine — output
  should be diagnostic-free.

## Release process (fully automated — do NOT `npm publish` manually)

1. Bump `version` in package.json, write `docs/release-notes-vX.Y.Z.md`
   (H1 becomes the GitHub Release title, rest becomes the body).
2. Commit, push, then `git tag -a vX.Y.Z -m "..."` and push the tag.
3. `.github/workflows/release.yml` tests on a clean runner, publishes to npm
   via **Trusted Publishing** (OIDC — no tokens anywhere) with
   `--provenance`, and creates the GitHub Release. Registry propagation
   takes ~2–4 minutes; verify with `npm view geiger-scan version` and an
   `npx geiger-scan@X.Y.Z` smoke run.
4. `docs/` and `.github/` stay out of the npm tarball via the package.json
   `files` whitelist — keep it that way.

## Conventions

- **No AI-attribution trailers in commits** (owner policy; history was
  rewritten once to remove them — don't reintroduce).
- Comment style: sparse, only for constraints the code can't show.
- Windows dev note: backslash-heavy content (fixtures, samples) goes through
  editor tooling, not bash heredocs/inline `node -e` — quoting mangles it.
- Sample reports in `docs/` (`sample-report.html/.json/.png`) are generated
  from the fixture home and sanitized to generic paths (`C:\Users\alex`) —
  regenerate + re-sanitize + re-screenshot together if report rendering
  changes.
- The README coverage table has a mirror on the product page
  (atomburst.io/geiger, maintained in a separate repo) — flag coverage
  changes so the page gets synced.
