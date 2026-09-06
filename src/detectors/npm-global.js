// Agent CLIs installed globally via npm — detected by reading the global
// node_modules directories directly. Geiger never executes npm.
import { j, isDir, exists } from '../util/fsx.js';
import { npmGlobalRoots } from '../platform.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KNOWN = require('../../data/known-agents.json');

export default {
  id: 'npm-global',
  name: 'Global npm agent CLIs',
  run() {
    const out = [];
    for (const root of npmGlobalRoots()) {
      if (!isDir(root)) continue;
      for (const [pkg, display] of Object.entries(KNOWN.npmGlobalAgents)) {
        const dir = pkg.startsWith('@') ? j(root, ...pkg.split('/')) : j(root, pkg);
        if (!exists(dir)) continue;
        out.push({
          detector: 'npm-global', kind: 'agent', name: display,
          origin: { type: 'registry', ref: pkg },
          exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
          evidence: [{ file: dir, note: 'globally installed package' }],
        });
      }
    }
    return out;
  },
};
