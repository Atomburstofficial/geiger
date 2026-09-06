// Terminal report — the screenshot surface. Plain language, no theater.
import os from 'node:os';
import { EXPOSURES, actionsFor } from '../engine.js';
import { redact } from '../redact.js';

const TTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const cyan = (s) => c('96', s);
const yellow = (s) => c('93', s);
const red = (s) => c('91', s);
const green = (s) => c('92', s);

const CHIP_COLOR = {
  EXECUTES: red,
  'HOLDS-SECRETS': yellow,
  'BROAD-FILESYSTEM': yellow,
  'BROAD-WEB': yellow,
  NETWORK: dim,
  'UNKNOWN-ORIGIN': red,
};

const KIND_LABEL = {
  agent: 'agent', harness: 'harness', 'mcp-server': 'MCP server', plugin: 'plugin',
  skill: 'skill', hook: 'hook', extension: 'extension', config: 'config',
};

export function render(result) {
  const { findings, diagnostics, meta } = result;
  const lines = [];
  const width = 62;
  lines.push('');
  lines.push(bold('  GEIGER') + dim('  ·  a Geiger counter for AI agents'));
  lines.push(dim('  machine ') + os.hostname() + dim('  ·  ') + new Date(meta.generatedAt).toISOString().slice(0, 16).replace('T', ' ') + dim(' UTC  ·  read-only · no telemetry'));
  lines.push(dim('  ' + '─'.repeat(width)));

  const execs = findings.filter((f) => f.exposures.includes('EXECUTES')).length;
  lines.push('');
  lines.push(`  ${bold(String(meta.total))} findings across ${new Set(findings.map((f) => f.detector)).size} ecosystems  ·  ` +
    `${red(String(execs))} can execute code  ·  ${yellow(String(meta.secretCount))} credential${meta.secretCount === 1 ? '' : 's'} in config files`);
  lines.push('');

  const byDetector = new Map();
  for (const f of findings) {
    if (!byDetector.has(f.detector)) byDetector.set(f.detector, []);
    byDetector.get(f.detector).push(f);
  }

  for (const [det, items] of byDetector) {
    lines.push('  ' + cyan(bold(det)) + dim(`  (${items.length})`));
    for (const f of items) {
      const chips = f.exposures.map((x) => (CHIP_COLOR[x] || dim)(`[${x}]`)).join(' ');
      const conf = f.confidence !== 'high' ? dim(` (${f.confidence} confidence)`) : '';
      lines.push(`    ${bold(redact(f.name))}  ${dim(KIND_LABEL[f.kind] || f.kind)}${conf}`);
      if (chips) lines.push(`      ${chips}`);
      if (f.origin && f.origin.ref) lines.push(dim(`      origin: ${f.origin.type} · ${redact(f.origin.ref)}`));
      for (const s of f.secrets) lines.push(yellow(`      credential: "${s.key}" — ${s.shape}`) + dim(` · ${s.file}`));
      for (const n of f.notes) lines.push(dim(`      note: ${redact(n)}`));
      for (const a of actionsFor(f)) lines.push(green('      fix: ') + dim(redact(a)));
    }
    lines.push('');
  }

  if (diagnostics.length) {
    lines.push('  ' + yellow(bold('detector diagnostics')) + dim(' (errors are reported, never swallowed)'));
    for (const d of diagnostics) lines.push(dim(`    ${d.detector}: ${d.error}`));
    lines.push('');
  }

  lines.push(dim('  ' + '─'.repeat(width)));
  lines.push(dim('  What the exposure labels mean:'));
  for (const [k, v] of Object.entries(EXPOSURES)) {
    if (findings.some((f) => f.exposures.includes(k))) lines.push(dim(`    ${k}: ${v}`));
  }
  lines.push('');
  lines.push(dim('  Geiger reads configs and directories only. It cannot see runtime'));
  lines.push(dim('  behavior, obfuscated code, or other user accounts — full list of'));
  lines.push(dim('  limitations: https://github.com/Atomburstofficial/geiger#limitations'));
  lines.push('');
  if (execs === 0 && meta.total === 0) lines.push(green('  No agent surface detected on this machine.'));
  return lines.join('\n');
}
