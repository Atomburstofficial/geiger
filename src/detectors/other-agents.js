// Other agent CLIs and harnesses detected by their home directories:
// Codex CLI, DeepSeek Harness (dsh), Gemini CLI, Aider, OpenCode.
// Where a config format is only partially parseable (TOML), presence is the
// finding and raw text is scanned for secret shapes — confidence marked.
import { j, exists, isDir, readText, listDir } from '../util/fsx.js';
import { home, appData } from '../platform.js';
import { scanText } from '../redact.js';
import { findingsFromMcpFile } from './common.js';

const AGENT_HOMES = [
  { dir: '.codex', name: 'Codex CLI', ref: '@openai/codex', config: 'config.toml' },
  { dir: '.gemini', name: 'Gemini CLI', ref: '@google/gemini-cli', config: 'settings.json' },
  { dir: '.aider', name: 'Aider', ref: 'aider-chat (pip)', config: null },
  { dir: '.opencode', name: 'OpenCode', ref: 'opencode', config: null },
  { dir: '.qwen', name: 'Qwen Code', ref: '@qwen-code/qwen-code', config: 'settings.json' },
  { dir: '.continue', name: 'Continue', ref: 'continue.dev', config: 'config.json' },
  { dir: '.copilot', name: 'GitHub Copilot CLI', ref: '@github/copilot', config: null },
  { dir: '.interpreter', name: 'Open Interpreter', ref: 'open-interpreter (pip)', config: null },
  { dir: '.lmstudio', name: 'LM Studio', ref: 'lmstudio.ai', config: null },
  { dir: '.ollama', name: 'Ollama', ref: 'ollama.com', config: null },
  { dir: '.grok', name: 'Grok Build', ref: 'xAI grok-build', config: 'config.toml' },
  { dir: '.junie', name: 'JetBrains Junie', ref: 'jetbrains.com/junie', config: null },
];

// DeepSeek Harness home is not fixed in upstream docs yet; check candidates
// and report which one matched. Low-friction to extend as the ecosystem moves.
function dshCandidates(h) {
  return [j(h, '.dsh'), j(h, '.deepseek-harness'), j(appData(), 'dsh'), j(h, '.config', 'dsh')];
}

export default {
  id: 'other-agents',
  name: 'Other agents & harnesses',
  run(ctx) {
    const h = home();
    const out = [];

    for (const a of AGENT_HOMES) {
      const dir = j(h, a.dir);
      const confFile = a.config ? j(dir, a.config) : null;
      if (!isDir(dir) && !(confFile && exists(confFile))) continue;
      const f = {
        detector: 'other-agents', kind: 'agent', name: a.name,
        origin: { type: 'registry', ref: a.ref },
        exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
        evidence: [{ file: dir, note: 'agent home directory' }],
        secrets: [], notes: [],
      };
      if (confFile && exists(confFile)) {
        const text = readText(confFile) || '';
        const shapes = scanText(text);
        if (shapes.length) {
          f.exposures.push('HOLDS-SECRETS');
          f.secrets = shapes.map((shape) => ({ key: '(in config text)', shape, file: confFile }));
        }
        if (/mcp_servers|mcpServers/.test(text)) {
          f.notes.push('config declares MCP servers (partially parsed — review ' + confFile + ')');
        }
      }
      out.push(f);
    }

    // Aider also uses dotfiles directly in home
    for (const n of ['.aider.conf.yml', '.aider.model.settings.yml']) {
      if (exists(j(h, n)) && !out.some((f) => f.name === 'Aider')) {
        out.push({
          detector: 'other-agents', kind: 'agent', name: 'Aider',
          origin: { type: 'registry', ref: 'aider-chat (pip)' },
          exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
          evidence: [{ file: j(h, n), note: 'config file' }],
        });
      }
    }

    for (const [dir, name, ref] of [[j(appData(), 'goose'), 'Goose', 'block/goose'], [j(h, '.config', 'goose'), 'Goose', 'block/goose'], [j(h, '.config', 'open-interpreter'), 'Open Interpreter', 'open-interpreter (pip)']]) {
      if (!isDir(dir)) continue;
      if (out.some((f) => f.name === name)) continue;
      out.push({
        detector: 'other-agents', kind: 'agent', name,
        origin: { type: 'registry', ref },
        exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
        evidence: [{ file: dir, note: 'agent config directory' }],
      });
    }

    // Kilo CLI: global config at ~/.config/kilo/kilo.jsonc (JSONC — the
    // tolerant parser handles comments); MCP servers live under the "mcp" key.
    const kiloDir = j(h, '.config', 'kilo');
    const kiloCfg = j(kiloDir, 'kilo.jsonc');
    if (isDir(kiloDir) || exists(kiloCfg)) {
      out.push({
        detector: 'other-agents', kind: 'agent', name: 'Kilo CLI',
        origin: { type: 'registry', ref: 'kilo.ai' },
        exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
        evidence: [{ file: exists(kiloCfg) ? kiloCfg : kiloDir, note: 'agent config (kilo.jsonc)' }],
      });
      out.push(...findingsFromMcpFile(kiloCfg, 'other-agents', 'Kilo CLI · global', 'mcp'));
    }
    for (const d of (ctx && ctx.paths) || []) {
      out.push(...findingsFromMcpFile(j(d, '.kilo', 'kilo.jsonc'), 'other-agents', 'Kilo CLI · project ' + d, 'mcp'));
      out.push(...findingsFromMcpFile(j(d, 'kilo.jsonc'), 'other-agents', 'Kilo CLI · project ' + d, 'mcp'));
    }

    for (const cand of dshCandidates(h)) {
      if (!isDir(cand)) continue;
      const profiles = listDir(cand).slice(0, 20);
      out.push({
        detector: 'other-agents', kind: 'harness', name: 'DeepSeek Harness (dsh)',
        origin: { type: 'registry', ref: '@deepseek-ai/dsh' },
        exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
        evidence: [{ file: cand, note: 'harness home (' + profiles.length + ' entries)' }],
        confidence: 'medium',
        notes: ['everything in dsh is a plugin — each installed plugin is its own supply chain'],
      });
      break;
    }
    return out;
  },
};
