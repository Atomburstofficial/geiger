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
