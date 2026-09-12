// AI-first browsers (Comet, Dia, ChatGPT Atlas): the browser itself is the
// agent. Presence is the finding. Their profiles use the Chromium layout, so
// browser-extensions.js walks them for AI extensions the same way it walks
// Chrome — this module only reports the host.
import { isDir } from '../util/fsx.js';
import { aiBrowserRoots } from '../platform.js';

export default {
  id: 'ai-browsers',
  name: 'AI browsers',
  run() {
    const out = [];
    for (const b of aiBrowserRoots()) {
      if (!isDir(b.dir)) continue;
      out.push({
        detector: 'ai-browsers', kind: 'browser', name: b.browser,
        origin: { type: 'store', ref: b.ref },
        exposures: ['BROAD-WEB', 'NETWORK'],
        evidence: [{ file: b.dir, note: 'browser profile directory' }],
        confidence: 'medium',
        notes: [
          b.note,
          'capabilities are inherent to the product, not read from a config — review its agent/assistant settings inside the browser',
        ],
      });
    }
    return out;
  },
};
