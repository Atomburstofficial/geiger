import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/engine.js';
import { detectors } from '../src/detectors/index.js';
import { classifyValue, scanEnvObject, redact } from '../src/redact.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function withHome(home, platform = 'win32') {
  process.env.GEIGER_HOME = path.join(fixtures, home);
  process.env.GEIGER_PLATFORM = platform;
}

test('empty home yields zero findings and zero diagnostics', async () => {
  withHome('empty');
  const r = await run(detectors, {});
  assert.equal(r.findings.length, 0);
  assert.equal(r.diagnostics.length, 0);
});

test('fixture home: agents, wrapped server, secrets, plugin inventory', async () => {
  withHome('home1');
  const r = await run(detectors, {});
  const names = r.findings.map((f) => f.name);

  const wrapped = r.findings.find((f) => f.name.startsWith('wrapped-server'));
  assert.ok(wrapped, 'wrapped server detected');
  assert.equal(wrapped.origin.type, 'registry');
  assert.equal(wrapped.origin.ref, '@example/mcp-thing');
  assert.ok(wrapped.notes.some((n) => n.includes('policy agent')), 'wrapper surfaced');
  assert.ok(wrapped.exposures.includes('HOLDS-SECRETS'));
  assert.equal(wrapped.secrets[0].key, 'API_KEY');
  assert.equal(wrapped.secrets[0].shape, 'Anthropic API key');

  const local = r.findings.find((f) => f.name.startsWith('local-script'));
  assert.ok(local.exposures.includes('UNKNOWN-ORIGIN'), 'local script flagged unknown-origin');

  const remote = r.findings.find((f) => f.name.startsWith('remote'));
  assert.equal(remote.origin.type, 'remote');

  assert.ok(names.some((n) => n.includes('hooks:')), 'hooks reported');
  assert.ok(names.includes('test-plugin'), 'plugin inventory parsed');

  const codex = r.findings.find((f) => f.name === 'Codex CLI');
  assert.ok(codex, 'codex detected');
  assert.ok(codex.exposures.includes('HOLDS-SECRETS'), 'secret shape found in toml text');

  // v0.2.1 coverage: Kilo, Grok Build, Firefox, JetBrains
  assert.ok(names.includes('Kilo CLI'), 'kilo cli detected');
  const kiloSrv = r.findings.find((f) => f.name.startsWith('kilo-tool'));
  assert.ok(kiloSrv, 'kilo mcp server parsed from kilo.jsonc (JSONC comments tolerated)');
  assert.equal(kiloSrv.origin.ref, '@example/kilo-tool@latest');
  assert.ok(names.includes('Grok Build'), 'grok build detected');
  const ff = r.findings.find((f) => f.name.startsWith('ChatGPT Sidebar'));
  assert.ok(ff, 'firefox AI extension detected');
  assert.ok(ff.exposures.includes('BROAD-WEB') && ff.exposures.includes('EXECUTES'), 'firefox permissions mapped (broad origins + nativeMessaging)');
  assert.ok(!r.findings.some((f) => f.name.startsWith('uBlock')), 'non-AI firefox extension ignored');
  const jb = r.findings.find((f) => f.detector === 'jetbrains');
  assert.ok(jb, 'jetbrains AI/MCP settings detected');
  assert.ok(jb.exposures.includes('EXECUTES'), 'mcp settings file implies configured servers can execute');
});

test('REDACTION GUARANTEE: no secret value ever appears in serialized output', async () => {
  withHome('home1');
  const r = await run(detectors, {});
  const blob = redact(JSON.stringify(r));
  assert.ok(!blob.includes('fixture00000000000000000000'), 'anthropic-shaped value leaked');
  assert.ok(!blob.includes('fixturefixturefixturefixture00'), 'openai-shaped value leaked');
});

test('secret shape classification', () => {
  assert.equal(classifyValue('sk-ant-abc12345678901234567890'), 'Anthropic API key');
  assert.equal(classifyValue('ghp_ABCDEFGHIJKLMNOPQRSTUV12'), 'GitHub token');
  assert.equal(classifyValue('hello world'), null);
  const hits = scanEnvObject({ MY_TOKEN: 'longopaquevalue123', NORMAL: 'yes' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].key, 'MY_TOKEN');
});

test('tolerant parser: lone backslashes in hand-edited Windows configs', async () => {
  const { parseJsonTolerant } = await import('../src/util/fsx.js');
  const raw = '{ "command": "C:\\Users\\me\\tool.exe" }';
  const r = parseJsonTolerant(raw);
  assert.equal(r.error, null);
  // note: escapes that are coincidentally valid JSON (like the \t in
  // \tool.exe) cannot be disambiguated — detection succeeds, exact path
  // fidelity is not promised for those characters.
  assert.ok(r.value.command.startsWith('C:'));
  assert.ok(r.value.command.includes('Users'));
});

test('diff mode: added, removed, escalated — and strict gates on drift only', async () => {
  const { diffResults } = await import('../src/diff.js');
  withHome('home1');
  const current = await run(detectors, {});

  // identical baseline → no drift
  const same = JSON.parse(JSON.stringify(current));
  const clean = diffResults(same, current);
  assert.equal(clean.added.length, 0);
  assert.equal(clean.removed.length, 0);
  assert.equal(clean.changed.length, 0);
  assert.equal(clean.newHot, 0);

  // mutate a baseline: drop one hot finding (→ shows as appeared),
  // invent one (→ shows as removed), strip an exposure (→ shows as changed)
  const base = JSON.parse(JSON.stringify(current));
  const dropped = base.findings.findIndex((f) => f.exposures.includes('EXECUTES'));
  const droppedName = base.findings[dropped].name;
  base.findings.splice(dropped, 1);
  base.findings.push({ detector: 'x', kind: 'agent', name: 'GhostAgent', origin: { type: 'registry', ref: 'ghost' }, exposures: [], secrets: [] });
  const weakened = base.findings.find((f) => f.exposures.includes('HOLDS-SECRETS'));
  if (weakened) weakened.exposures = weakened.exposures.filter((x) => x !== 'HOLDS-SECRETS');

  const d = diffResults(base, current);
  assert.ok(d.added.some((f) => f.name === droppedName), 'dropped finding reappears as added');
  assert.ok(d.removed.some((f) => f.name === 'GhostAgent'), 'invented finding shows as removed');
  if (weakened) assert.ok(d.changed.some((c) => c.deltas.includes('gained HOLDS-SECRETS')), 'escalation detected');
  assert.ok(d.newHot >= 1, 'new hot findings counted for strict drift gating');
});

test('remediation actions exist for hot findings', async () => {
  const { actionsFor } = await import('../src/engine.js');
  process.env.GEIGER_HOME = path.join(fixtures, 'home1');
  process.env.GEIGER_PLATFORM = 'win32';
  const r = await run(detectors, {});
  const wrapped = r.findings.find((f) => f.name.startsWith('wrapped-server'));
  const acts = actionsFor(wrapped);
  assert.ok(acts.length >= 2, 'mcp server with secret gets multiple actions');
  assert.ok(acts.some((a) => a.includes('Rotate')), 'secret rotation advised');
});
