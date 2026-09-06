// AI extensions installed in VS Code (and forks with the same layout).
import { j, listDir, isDir, readJson } from '../util/fsx.js';
import { home } from '../platform.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KNOWN = require('../../data/known-agents.json');

const AI_HINT = /\b(ai|copilot|llm|gpt|claude|gemini|agent|assistant|codeium|autocomplete)\b/i;

export default {
  id: 'vscode-extensions',
  name: 'VS Code AI extensions',
  run() {
    const out = [];
    const roots = [j(home(), '.vscode', 'extensions'), j(home(), '.vscode-insiders', 'extensions'), j(home(), '.vscode-oss', 'extensions'), j(home(), '.cursor', 'extensions')];
    const seen = new Set();
    for (const root of roots) {
      if (!isDir(root)) continue;
      for (const entry of listDir(root)) {
        // folder form: publisher.name-1.2.3[-platform]
        const m = entry.match(/^([a-z0-9-]+\.[a-z0-9-]+)-\d/i);
        if (!m) continue;
        const id = m[1].toLowerCase();
        if (seen.has(id)) continue;
        const known = KNOWN.vscodeExtensions[id];
        let matched = Boolean(known);
        let display = known || id;
        if (!matched) {
          const pkg = readJson(j(root, entry, 'package.json')).value;
          const hay = [pkg && pkg.displayName, pkg && pkg.description, ...((pkg && pkg.keywords) || [])].filter(Boolean).join(' ');
          if (AI_HINT.test(id) || AI_HINT.test(hay)) { matched = true; display = (pkg && pkg.displayName) || id; }
        }
        if (!matched) continue;
        seen.add(id);
        out.push({
          detector: 'vscode-extensions', kind: 'extension', name: display,
          origin: { type: 'store', ref: id },
          exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
          evidence: [{ file: j(root, entry), note: 'installed editor extension' }],
          confidence: known ? 'high' : 'medium',
          notes: ['editor extensions run with full user permissions inside the editor process'],
        });
      }
    }
    return out;
  },
};
