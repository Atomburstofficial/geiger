#!/usr/bin/env node
// geiger — a Geiger counter for AI agents. Read-only. No telemetry.
import fs from 'node:fs';
import { run } from '../src/engine.js';
import { detectors } from '../src/detectors/index.js';
import { render } from '../src/report/terminal.js';
import { redact } from '../src/redact.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

if (has('--help') || has('-h')) {
  console.log(`
geiger — a Geiger counter for AI agents

Inventories every AI agent, harness, MCP server, plugin, and AI extension
on this machine, and reports what each one can touch. Reads configs and
directories only. Never writes (except --json to a file you name), never
phones home.

Usage:
  npx geiger-scan             scan and print the terminal report
  npx geiger-scan --json out.json   also write machine-readable findings
  npx geiger-scan --strict    exit 2 if anything can execute code or holds secrets

Environment:
  NO_COLOR=1                  disable colors
`);
  process.exit(0);
}

const result = await run(detectors, { cwd: process.cwd() });

console.log(render(result));

const jsonIx = args.indexOf('--json');
if (jsonIx !== -1) {
  const out = args[jsonIx + 1];
  if (!out || out.startsWith('-')) {
    console.error('geiger: --json needs a file path');
    process.exit(1);
  }
  // The single write geiger ever performs — to the file you asked for.
  fs.writeFileSync(out, redact(JSON.stringify(result, null, 2)) + '\n');
  console.log(`  findings written to ${out} (schemaVersion ${result.meta.schemaVersion})\n`);
}

if (has('--strict')) {
  const hot = result.findings.some((f) => f.exposures.includes('EXECUTES') || f.exposures.includes('HOLDS-SECRETS'));
  process.exit(hot ? 2 : 0);
}
