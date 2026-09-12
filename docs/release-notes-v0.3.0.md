# v0.3.0 — hosts by presence, AI browsers, hooks beyond Claude Code

Three new detectors close the gaps a one-shot config scan used to have:

- **AI apps & IDEs by presence** — Cursor, Windsurf, Zed, Claude Desktop,
  ChatGPT Desktop and the Codex desktop app are now findings in their own
  right. Before, a client with zero MCP servers configured was invisible;
  an installed Cursor is a code-executing agent whether or not it has
  servers yet. Two new finding kinds, `app` and `browser`, keep the labels
  honest: agentic IDEs get EXECUTES, chat clients get NETWORK only.
- **AI browsers** — Comet, Dia and ChatGPT Atlas are reported when their
  profile directory exists: the browser *is* the agent, so its presence is
  the finding (BROAD-WEB, medium confidence — capabilities are inherent to
  the product, not read from a config). Their Chromium profiles, plus
  Vivaldi and Arc, now join the AI-extension walk alongside Chrome, Edge
  and Brave.
- **Hooks for Cursor, Codex and Gemini CLI** — Cursor `hooks.json`, the
  root-table `notify` key in Codex `config.toml` (a tolerant one-key TOML
  line reader — still zero dependencies) and Gemini CLI settings hooks.
  Each hook's command is listed in the report, because hooks run with no
  prompt and no model in the loop. Claude Code hooks were already covered.

Every new detector ships with fixture files and assertions; the Codex
reader has its own unit test (continuation lines, escapes, section scoping,
BOM, unterminated arrays).

Limitations added to the README: AI browser and desktop-app paths for Dia,
ChatGPT Atlas and ChatGPT Desktop on macOS are best-effort — a wrong guess
finds nothing rather than something false.

Also since v0.2.1: a **Requirements** section in the README (Node 18+ is the
only prerequisite, one-line installs per OS).

Read-only, no telemetry, secrets by shape only — unchanged, as always.
