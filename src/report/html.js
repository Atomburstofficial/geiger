// Self-contained HTML report — evidence-style, no external assets.
import os from 'node:os';
import { EXPOSURES, actionsFor } from '../engine.js';
import { redact } from '../redact.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHIP = {
  EXECUTES: '#ff7a6b', 'HOLDS-SECRETS': '#e8a33d', 'BROAD-FILESYSTEM': '#e8a33d',
  'BROAD-WEB': '#e8a33d', NETWORK: '#8291a5', 'UNKNOWN-ORIGIN': '#ff7a6b',
};

export function renderHtml(result) {
  const { findings, diagnostics, meta } = result;
  const execs = findings.filter((f) => f.exposures.includes('EXECUTES')).length;
  const byDetector = new Map();
  for (const f of findings) {
    if (!byDetector.has(f.detector)) byDetector.set(f.detector, []);
    byDetector.get(f.detector).push(f);
  }
  const chip = (x) => `<span style="display:inline-block;font-size:10px;letter-spacing:.08em;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid ${CHIP[x]}66;color:${CHIP[x]};margin-right:4px">${x}</span>`;

  const sections = [...byDetector.entries()].map(([det, items]) => `
    <h2>${esc(det)} <small>(${items.length})</small></h2>
    ${items.map((f) => {
      const acts = actionsFor(f);
      return `<div class="card">
        <div class="fh"><b>${esc(redact(f.name))}</b> <span class="kind">${esc(f.kind)}</span>${f.confidence !== 'high' ? ` <span class="kind">${f.confidence} confidence</span>` : ''}</div>
        <div>${f.exposures.map(chip).join('')}</div>
        ${f.origin && f.origin.ref ? `<div class="meta">origin: ${esc(f.origin.type)} · <code>${esc(redact(f.origin.ref))}</code></div>` : ''}
        ${f.evidence.map((e) => `<div class="meta">evidence: <code>${esc(e.file)}</code> — ${esc(e.note)}</div>`).join('')}
        ${f.secrets.map((s) => `<div class="secret">credential: <code>${esc(s.key)}</code> — ${esc(s.shape)} · <code>${esc(s.file)}</code></div>`).join('')}
        ${f.notes.map((n) => `<div class="meta">note: ${esc(redact(n))}</div>`).join('')}
        ${acts.length ? `<div class="acts"><b>What to do</b><ul>${acts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      </div>`;
    }).join('')}`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Geiger report — ${esc(os.hostname())}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0a0b0e;color:#edeef2;font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;padding:40px 20px}
  .wrap{max-width:880px;margin:0 auto}
  h1{font-size:22px;letter-spacing:.02em;margin:0 0 4px}
  h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#7fe9ff;margin:34px 0 10px}
  h2 small{color:#838b99;font-weight:400;text-transform:none}
  .sub{color:#838b99;font-size:13px;margin-bottom:26px}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:22px 0}
  .tile{border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:14px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))}
  .tile b{font-size:22px;display:block}
  .tile span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#838b99}
  .card{border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:14px 16px;margin:10px 0;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01))}
  .fh{margin-bottom:6px}
  .kind{font-size:11px;color:#838b99;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 8px;margin-left:6px}
  .meta{color:#a6adbb;font-size:13px;margin-top:4px}
  .secret{color:#e8a33d;font-size:13px;margin-top:4px}
  .acts{margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;font-size:13px;color:#a6adbb}
  .acts ul{margin:4px 0 0 18px;padding:0}
  code{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#c9d2de;word-break:break-all}
  .legend{border:1px dashed rgba(255,255,255,.15);border-radius:12px;padding:12px 16px;margin-top:30px;font-size:13px;color:#a6adbb}
  footer{margin-top:26px;color:#838b99;font-size:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px}
</style></head><body><div class="wrap">
<h1>GEIGER <span style="color:#838b99;font-weight:400">· a Geiger counter for AI agents</span></h1>
<div class="sub">machine ${esc(os.hostname())} · ${esc(meta.generatedAt)} · schemaVersion ${meta.schemaVersion} · read-only · no telemetry</div>
<div class="tiles">
  <div class="tile"><b>${meta.total}</b><span>findings</span></div>
  <div class="tile"><b style="color:#ff7a6b">${execs}</b><span>can execute code</span></div>
  <div class="tile"><b style="color:#e8a33d">${meta.secretCount}</b><span>credentials in configs</span></div>
  <div class="tile"><b>${byDetector.size}</b><span>ecosystems</span></div>
</div>
${sections}
${diagnostics.length ? `<h2>diagnostics</h2>${diagnostics.map((d) => `<div class="meta">${esc(d.detector)}: ${esc(d.error)}</div>`).join('')}` : ''}
<div class="legend"><b>Exposure labels.</b> ${Object.entries(EXPOSURES).map(([k, v]) => `<div>${chip(k)} ${esc(v)}</div>`).join('')}</div>
<footer>Generated by geiger — reads configs and directories only; cannot see runtime behavior, obfuscated code, or other user accounts. Secret values are never included in this report. <a style="color:#7fe9ff" href="https://github.com/Atomburstofficial/geiger">github.com/Atomburstofficial/geiger</a></footer>
</div></body></html>`;
}
