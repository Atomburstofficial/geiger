# v0.2.1 — coverage expansion

Four ecosystems added, prompted by launch-day feedback:

- **Kilo CLI** — agent detection plus full MCP-server parsing from
  `~/.config/kilo/kilo.jsonc` (JSONC comments handled) and project-level
  `.kilo/kilo.jsonc` / `kilo.jsonc`.
- **Grok Build (xAI)** — `~/.grok` home with `config.toml` scanned for
  secret shapes and MCP declarations.
- **Firefox** — AI extensions per profile from `extensions.json`, with
  granted permissions mapped the same way as Chromium browsers
  (broad origins → BROAD-WEB, nativeMessaging → EXECUTES).
- **JetBrains** — AI Assistant / MCP settings detection per IDE product.
  JetBrains stores MCP config inside the IDE settings store rather than a
  documented file, so geiger reports that it exists, where, and which
  settings screen to review (medium confidence, honestly labeled). The
  Junie agent's `~/.junie` home is detected alongside the other agent CLIs.

No behavior changes to existing detectors. Read-only, no telemetry, secrets
by shape only — unchanged, as always.
