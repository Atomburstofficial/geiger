#!/usr/bin/env node
// geiger — a Geiger counter for AI agents. Read-only. No telemetry.
import fs from 'node:fs';
import { run } from '../src/engine.js';
import { detectors } from '../src/detectors/index.js';
import { render } from '../src/report/terminal.js';
import { renderHtml } from '../src/report/html.js';
import { redact } from '../src/redact.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valuesOf = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] && !args[i + 1].startsWith('-') ? [args[i + 1]] : []));

if (has('--help') || has('-h')) {
  console.log(`
geiger — a Geiger counter for AI agents

Inventories every AI agent, harness, MCP server, plugin, and AI extension
on this machine, and reports what each one can touch. Reads configs and
directories only. Writes nothing except the report files you name.

Usage:
  npx geiger-scan                       scan and print the terminal report
  npx geiger-scan --html report.html    also write a self-contained HTML report
  npx geiger-scan --json out.json       also write machine-readable findings
  npx geiger-scan --path D:\\repo1 --path E:\\repo2
                                        also scan these project directories for
                                        project-level agent/MCP configs
  npx geiger-scan --home C:\\Users\\other
                                        scan a different home root (another
                                        user profile, a mounted image)
  npx geiger-scan --strict              exit 2 if anything can execute code
                                        or holds secrets

Environment:  NO_COLOR=1 disables colors
`);
  process.exit(0);
}

const homeOverride = valuesOf('--home')[0];
if (homeOverride) process.env.GEIGER_HOME = homeOverride;

const extraPaths = valuesOf('--path');
const ctx = { cwd: process.cwd(), paths: [process.cwd(), ...extraPaths] };

const result = await run(detectors, ctx);

console.log(render(result));

function outFileArg(flag) {
  const v = valuesOf(flag)[0];
  if (args.includes(flag) && !v) {
    console.error(`geiger: ${flag} needs a file path`);
    process.exit(1);
  }
  return v;
}

const jsonOut = outFileArg('--json');
if (jsonOut) {
  fs.writeFileSync(jsonOut, redact(JSON.stringify(result, null, 2)) + '\n');
  console.log(`  findings written to ${jsonOut} (schemaVersion ${result.meta.schemaVersion})`);
}
const htmlOut = outFileArg('--html');
if (htmlOut) {
  fs.writeFileSync(htmlOut, redact(renderHtml(result)));
  console.log(`  HTML report written to ${htmlOut}`);
}
if (jsonOut || htmlOut) console.log('');

if (has('--strict')) {
  const hot = result.findings.some((f) => f.exposures.includes('EXECUTES') || f.exposures.includes('HOLDS-SECRETS'));
  process.exit(hot ? 2 : 0);
}
