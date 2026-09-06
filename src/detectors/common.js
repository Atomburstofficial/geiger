// Shared logic for the many places MCP server configs live.
import { readJson } from '../util/fsx.js';
import { assessMcpServer } from '../engine.js';
import { scanEnvObject } from '../redact.js';

/**
 * Read a JSON config file and emit one finding per entry under `mcpServers`
 * (or a custom key). Silently returns [] when the file is absent; emits a
 * low-confidence config finding when present but unparseable.
 */
export function findingsFromMcpFile(file, detector, hostLabel, key = 'mcpServers') {
  const { value, error } = readJson(file);
  if (error === 'missing') return [];
  if (error) {
    return [{
      detector, kind: 'config', name: `unparseable config (${hostLabel})`,
      origin: { type: 'local', ref: file },
      exposures: [], evidence: [{ file, note: error }],
      confidence: 'low',
      notes: ['file exists but could not be parsed — review it by hand'],
    }];
  }
  const servers = (value && value[key]) || {};
  const out = [];
  for (const [name, server] of Object.entries(servers)) {
    const f = assessMcpServer(name, server, file, detector, hostLabel);
    const hits = scanEnvObject(server && server.env);
    if (hits.length) {
      f.exposures = [...new Set([...f.exposures, 'HOLDS-SECRETS'])];
      f.secrets = hits.map((h) => ({ ...h, file }));
    }
    out.push(f);
  }
  return out;
}
