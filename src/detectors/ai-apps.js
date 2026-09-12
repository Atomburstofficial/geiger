// AI desktop apps and agentic IDEs, detected by their config / app-data
// directories. MCP servers configured inside them are reported by
// mcp-hosts.js; this module reports the host itself, so an installed but
// unconfigured Cursor or Claude Desktop still appears in the inventory.
import { j, isDir } from '../util/fsx.js';
import { home, appData, localAppData, platform } from '../platform.js';

const AGENTIC = ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'];

function apps() {
  const h = home();
  const a = appData();
  const l = localAppData();
  const win = platform() === 'win32';
  return [
    { name: 'Cursor', kind: 'agent', dirs: [j(h, '.cursor')], ref: 'cursor.com', exposures: AGENTIC,
      notes: ['agentic IDE — its agent runs shell commands and edits files as this user'] },
    { name: 'Windsurf', kind: 'agent', dirs: [j(h, '.codeium', 'windsurf')], ref: 'windsurf.com', exposures: AGENTIC,
      notes: ['agentic IDE — Cascade runs shell commands and edits files as this user'] },
    { name: 'Zed', kind: 'app', dirs: [j(h, '.config', 'zed'), j(a, 'Zed')], ref: 'zed.dev', exposures: ['NETWORK'],
      notes: ['editor with a built-in agent panel; MCP servers configured here extend what it can touch'] },
    { name: 'Claude Desktop', kind: 'app', dirs: [j(a, 'Claude')], ref: 'claude.ai/download', exposures: ['NETWORK'],
      notes: ['chat client; MCP servers configured here extend what it can touch'] },
    { name: 'ChatGPT Desktop', kind: 'app', ref: 'openai.com/chatgpt/desktop', exposures: ['NETWORK'],
      dirs: [win ? j(l, 'Packages', 'OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0') : j(a, 'com.openai.chat')],
      notes: ['chat client; on macOS "Work with Apps" lets it read content from other applications'] },
    { name: 'Codex (desktop app)', kind: 'agent', ref: 'openai.com/codex', exposures: AGENTIC,
      dirs: win ? [j(l, 'Packages', 'OpenAI.Codex_2p2nqsd0c76g0')] : [],
      notes: ['desktop front-end for the Codex agent — runs commands and edits files as this user'] },
  ];
}

export default {
  id: 'ai-apps',
  name: 'AI desktop apps & IDEs',
  run() {
    const out = [];
    for (const app of apps()) {
      const dir = app.dirs.find((d) => isDir(d));
      if (!dir) continue;
      out.push({
        detector: 'ai-apps', kind: app.kind, name: app.name,
        origin: { type: 'store', ref: app.ref },
        exposures: app.exposures,
        evidence: [{ file: dir, note: 'application data directory' }],
        notes: app.notes,
      });
    }
    return out;
  },
};
