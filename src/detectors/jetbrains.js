// JetBrains IDEs: AI Assistant / MCP settings live inside the IDE's own
// settings store (per-product options XML), not a stable documented file.
// Geiger reports that AI/MCP settings exist and where — the review itself
// happens in the IDE: Settings → Tools → AI Assistant → Model Context
// Protocol. JetBrains' agent Junie is detected via ~/.junie (other-agents).
import { j, isDir, listDir } from '../util/fsx.js';
import { appData } from '../platform.js';

export default {
  id: 'jetbrains',
  name: 'JetBrains IDEs',
  run() {
    const out = [];
    const root = j(appData(), 'JetBrains');
    if (!isDir(root)) return out;
    for (const product of listDir(root).filter((p) => isDir(j(root, p, 'options')))) {
      const opts = j(root, product, 'options');
      const aiFiles = listDir(opts).filter((f) => /mcp|aiassistant|llm|junie/i.test(f));
      if (!aiFiles.length) continue;
      const hasMcp = aiFiles.some((f) => /mcp/i.test(f));
      out.push({
        detector: 'jetbrains', kind: 'config',
        name: 'JetBrains AI Assistant (' + product + ')',
        origin: { type: 'store', ref: 'JetBrains Marketplace' },
        exposures: hasMcp ? ['EXECUTES', 'NETWORK'] : ['NETWORK'],
        evidence: aiFiles.slice(0, 5).map((f) => ({ file: j(opts, f), note: 'AI/MCP settings inside the IDE settings store' })),
        confidence: 'medium',
        notes: ['MCP servers configured here run as your user — review in Settings → Tools → AI Assistant → Model Context Protocol'],
      });
    }
    return out;
  },
};
