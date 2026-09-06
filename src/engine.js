// The Geiger engine: run every detector, collect findings, never crash.
// A detector that throws becomes a diagnostic in the report, not a failure.

export const EXPOSURES = {
  EXECUTES: 'can execute code or commands on this machine, on its own schedule or an agent\'s',
  'HOLDS-SECRETS': 'configuration contains credential-shaped values',
  'BROAD-FILESYSTEM': 'reaches the filesystem beyond a single project',
  'BROAD-WEB': 'can read or modify pages across all websites',
  NETWORK: 'talks to remote services',
  'UNKNOWN-ORIGIN': 'origin could not be traced to a known registry or store',
};

const EXPOSURE_ORDER = ['EXECUTES', 'HOLDS-SECRETS', 'BROAD-FILESYSTEM', 'BROAD-WEB', 'NETWORK', 'UNKNOWN-ORIGIN'];

/**
 * @typedef {Object} Finding
 * @property {string} detector    detector id
 * @property {string} kind        agent|harness|mcp-server|plugin|skill|hook|extension|config
 * @property {string} name
 * @property {{type:string, ref?:string}} origin  registry|store|git|local|remote|unknown
 * @property {string[]} exposures keys of EXPOSURES
 * @property {{file:string, note:string}[]} evidence
 * @property {{key:string, shape:string, file:string}[]} secrets
 * @property {'high'|'medium'|'low'} confidence
 * @property {string[]} notes
 */

/** Normalize and sort a finding's exposures. */
export function finding(f) {
  return {
    detector: f.detector,
    kind: f.kind,
    name: f.name,
    origin: f.origin || { type: 'unknown' },
    exposures: [...new Set(f.exposures || [])].sort((a, b) => EXPOSURE_ORDER.indexOf(a) - EXPOSURE_ORDER.indexOf(b)),
    evidence: f.evidence || [],
    secrets: f.secrets || [],
    confidence: f.confidence || 'high',
    notes: f.notes || [],
  };
}

/**
 * Classify an MCP-style server entry ({command,args,url,env}) into a finding
 * fragment. Shared by every detector that reads MCP configs — one definition
 * of truth for "what does this server mean".
 */
export function assessMcpServer(name, server, file, detector, hostLabel) {
  const exposures = [];
  const notes = [];
  let origin = { type: 'unknown' };
  const cmd = server && (server.command || '');
  const args = (server && server.args) || [];
  const url = server && (server.url || server.serverUrl);

  if (url) {
    exposures.push('NETWORK');
    origin = { type: 'remote', ref: String(url).slice(0, 120) };
    notes.push('remote MCP server — its behavior can change server-side at any time');
  } else if (cmd) {
    exposures.push('EXECUTES', 'BROAD-FILESYSTEM');
    // Policy wrappers (e.g. DomainGuard) run the real server after `--`.
    // Report the effective server and surface the enforcement layer.
    let tokens = [cmd, ...args.map(String)];
    const dash = tokens.indexOf('--');
    if (dash !== -1 && dash < tokens.length - 1) {
      const wrapper = tokens[0].split(/[\\/]/).pop();
      notes.push('wrapped by a policy agent (' + wrapper + ') — enforcement layer in front of the server');
      tokens = tokens.slice(dash + 1);
    }
    const eff = tokens[0] || '';
    const line = tokens.join(' ');
    if (/\bnpx\b|\bbunx\b/.test(line)) {
      const ni = tokens.findIndex((t) => /^(npx|bunx)$/.test((t.split(/[\\/]/).pop() || '')));
      const pkg = tokens.slice(ni + 1).find((t) => !t.startsWith('-'));
      origin = { type: 'registry', ref: pkg ? String(pkg) : undefined };
      notes.push('fetched from a package registry when the agent starts it');
    } else if (/docker/.test(eff)) {
      origin = { type: 'registry', ref: 'docker: ' + tokens.slice(-1)[0] };
      notes.push('runs in a container — filesystem reach depends on mounts');
    } else if (/node|python|python3|deno|bun|sh|bash|cmd|powershell/i.test(eff)) {
      origin = { type: 'local', ref: String(tokens[1] || eff).slice(0, 120) };
      exposures.push('UNKNOWN-ORIGIN');
      notes.push('runs a local script — nothing ties it to a published, reviewable package');
    } else {
      origin = { type: 'local', ref: String(eff).slice(0, 120) };
    }
  }

  const secrets = [];
  if (server && server.env) {
    // scanned by caller with scanEnvObject; caller attaches file
  }
  return finding({
    detector,
    kind: 'mcp-server',
    name: hostLabel ? `${name} (${hostLabel})` : name,
    origin,
    exposures,
    evidence: [{ file, note: 'MCP server entry' }],
    secrets,
    notes,
  });
}

/**
 * Run all detectors. Returns { findings, diagnostics, meta }.
 * @param {Array<{id:string, name:string, run:(ctx:object)=>Finding[]}>} detectors
 */
export async function run(detectors, ctx = {}) {
  const findings = [];
  const diagnostics = [];
  for (const d of detectors) {
    try {
      const out = await d.run(ctx);
      for (const f of out || []) findings.push(finding(f));
    } catch (e) {
      diagnostics.push({ detector: d.id, error: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
  const counts = {};
  for (const f of findings) for (const x of f.exposures) counts[x] = (counts[x] || 0) + 1;
  const secretCount = findings.reduce((a, f) => a + f.secrets.length, 0);
  return {
    findings,
    diagnostics,
    meta: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      node: process.version,
      counts,
      secretCount,
      total: findings.length,
    },
  };
}
