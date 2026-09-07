# v0.1.0 — first public release

**A Geiger counter for AI agents.** One read-only command that inventories
every AI agent, harness, MCP server, plugin, and AI extension on a machine —
and tells you, in plain language, what each one can touch.

```
npx geiger-scan
```

## What's in 0.1.0

- **Six detector families:** Claude Code (MCP servers global + per-project,
  hooks, plugins, skills, subagents, apiKeyHelper), MCP hosts (Claude
  Desktop, Cursor, Windsurf, VS Code, Cline, Roo Code, Continue, Zed), other
  agents (Codex CLI, Gemini CLI, Aider, Goose, Copilot CLI, DeepSeek
  Harness, Open Interpreter, LM Studio, Ollama, and more), VS Code AI
  extensions, global npm agent CLIs (read directly — npm is never executed),
  and browser AI extensions with their manifest permissions.
- **Exposure labels, not scores:** EXECUTES · HOLDS-SECRETS ·
  BROAD-FILESYSTEM · BROAD-WEB · NETWORK · UNKNOWN-ORIGIN.
- **Secrets by shape only** — key name, file, and shape; never the value.
  A redaction pass runs on all output and the test suite enforces it.
- **Policy-wrapper awareness:** wrapped MCP servers report both the
  enforcement layer and the effective server behind it.
- **Reports:** colored terminal report, self-contained `--html` report with
  per-finding "What to do" remediation, versioned `--json` (schemaVersion 1)
  for fleet diffing.
- **Scoping flags:** `--path` (repeatable) for extra project directories,
  `--home` for another user profile or mounted image, `--strict` for CI
  (exit 2 on EXECUTES/HOLDS-SECRETS).
- Zero runtime dependencies, no build step, no telemetry. CI on
  Linux/macOS/Windows × Node 18/20/22.

## Known limitations

Stated in full in the [README](https://github.com/Atomburstofficial/geiger#limitations):
known config locations only; configuration, not runtime behavior; origin ≠
trustworthiness.
