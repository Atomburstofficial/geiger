// Hooks outside Claude Code: shell commands an AI tool runs automatically on
// its own events — no prompt, no model in the loop. Claude Code's hooks are
// reported by claude-code.js; this covers Cursor (hooks.json), Codex
// (`notify` in config.toml) and Gemini CLI (hooks in settings.json).
import { j, readJson, readText } from '../util/fsx.js';
import { home } from '../platform.js';

const CMD_CAP = 160;
const MAX_CMDS = 8;

function hookFinding(tool, events, file, commands) {
  return {
    detector: 'hooks', kind: 'hook', name: `${tool} hooks: ${events.join(', ')}`,
    origin: { type: 'local', ref: file },
    exposures: ['EXECUTES'],
    evidence: [{ file, note: 'shell commands that run automatically on agent events' }],
    notes: [
      'hooks execute without a prompt each time their event fires',
      ...commands.slice(0, MAX_CMDS).map((c) => 'command: ' + c),
    ],
  };
}

/**
 * Cursor / Gemini style: { hooks: { <event>: [ {command} | "cmd" ] } }.
 * Claude-style groups ({ matcher, hooks: [ {command} ] }) are unwrapped too,
 * so a tool that adopts either shape is read without a code change.
 */
function fromHooksObject(tool, file) {
  const { value } = readJson(file);
  const hooks = value && value.hooks;
  if (!hooks || typeof hooks !== 'object') return [];
  const events = [];
  const commands = [];
  for (const [ev, raw] of Object.entries(hooks)) {
    const list = Array.isArray(raw) ? raw : [raw];
    let any = false;
    for (const h of list) {
      const entry = typeof h === 'string' ? { command: h } : h;
      const inner = entry && Array.isArray(entry.hooks) ? entry.hooks : [entry];
      for (const e of inner) {
        const cmd = e && (Array.isArray(e.command) ? e.command.join(' ') : e.command);
        if (typeof cmd !== 'string' || !cmd.trim()) continue;
        any = true;
        commands.push(cmd.trim().slice(0, CMD_CAP));
      }
    }
    if (any) events.push(ev);
  }
  return events.length ? [hookFinding(tool, events, file, commands)] : [];
}

/**
 * Codex: root-table `notify = ["bin", "arg", ...]` (or a bare string) in
 * config.toml. A tolerant line reader for one key — no TOML dependency.
 * Returns every root-level notify command found (a duplicate key is itself
 * worth seeing). Never throws.
 */
export function parseCodexNotify(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const found = [];
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const sec = /^\[+\s*([^\]]*?)\s*\]+/.exec(line);
    if (sec) { section = sec[1]; continue; }
    if (section !== '') continue;
    const m = /^notify\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let buf = m[1];
    const bal = (s) => s.split('[').length - s.split(']').length;
    for (let k = 0; bal(buf) > 0 && i + 1 < lines.length && k < 40; k++) buf += ' ' + lines[++i].trim();
    buf = buf.replace(/\s*#.*$/, '').trim();
    const unesc = (s) => s.replace(/\\(["'\\/])/g, '$1');
    const parts = [];
    const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g;
    let s;
    while ((s = re.exec(buf)) && parts.length < 60) parts.push(unesc(s[1] !== undefined ? s[1] : s[2]));
    if (parts.length) found.push(parts.join(' ').slice(0, CMD_CAP));
  }
  return found;
}

export default {
  id: 'hooks',
  name: 'Agent hooks (Cursor, Codex, Gemini CLI)',
  run(ctx) {
    const h = home();
    const out = [];
    const projDirs = (ctx.paths && ctx.paths.length ? ctx.paths : [ctx.cwd]).filter(Boolean);
    for (const f of [j(h, '.cursor', 'hooks.json'), ...projDirs.map((d) => j(d, '.cursor', 'hooks.json'))]) {
      out.push(...fromHooksObject('Cursor', f));
    }
    out.push(...fromHooksObject('Gemini CLI', j(h, '.gemini', 'settings.json')));
    const codexFile = j(h, '.codex', 'config.toml');
    const text = readText(codexFile);
    if (text) {
      const cmds = parseCodexNotify(text);
      if (cmds.length) out.push(hookFinding('Codex', ['notify'], codexFile, cmds));
    }
    return out;
  },
};
