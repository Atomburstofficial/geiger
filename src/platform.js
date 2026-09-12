// Per-OS path tables, centralized so detectors stay platform-agnostic.
// Overridable for tests via env GEIGER_HOME (fixture root).
import os from 'node:os';
import { j } from './util/fsx.js';

export function home() {
  return process.env.GEIGER_HOME || os.homedir();
}

export function platform() {
  return process.env.GEIGER_PLATFORM || process.platform; // 'win32' | 'darwin' | 'linux'
}

/** Roaming app-data style dir per OS. */
export function appData() {
  const h = home();
  switch (platform()) {
    case 'win32': return process.env.GEIGER_HOME ? j(h, 'AppData', 'Roaming') : (process.env.APPDATA || j(h, 'AppData', 'Roaming'));
    case 'darwin': return j(h, 'Library', 'Application Support');
    default: return process.env.XDG_CONFIG_HOME || j(h, '.config');
  }
}

/** Local app-data style dir per OS (Chrome profiles live here on win). */
export function localAppData() {
  const h = home();
  switch (platform()) {
    case 'win32': return process.env.GEIGER_HOME ? j(h, 'AppData', 'Local') : (process.env.LOCALAPPDATA || j(h, 'AppData', 'Local'));
    case 'darwin': return j(h, 'Library', 'Application Support');
    default: return process.env.XDG_DATA_HOME || j(h, '.config');
  }
}

/** Candidate global npm roots (checked, not executed — geiger never runs npm). */
export function npmGlobalRoots() {
  const h = home();
  switch (platform()) {
    case 'win32': return [j(appData(), 'npm', 'node_modules')];
    case 'darwin': return ['/usr/local/lib/node_modules', '/opt/homebrew/lib/node_modules', j(h, '.npm-global', 'lib', 'node_modules'), j(h, '.npm-global', 'node_modules')];
    default: return ['/usr/local/lib/node_modules', '/usr/lib/node_modules', j(h, '.npm-global', 'lib', 'node_modules'), j(h, '.npm-global', 'node_modules')];
  }
}

/** Firefox profile roots (profiles live one level below; extensions.json per profile). */
export function firefoxProfileRoots() {
  const h = home();
  switch (platform()) {
    case 'win32': return [j(appData(), 'Mozilla', 'Firefox', 'Profiles')];
    case 'darwin': return [j(h, 'Library', 'Application Support', 'Firefox', 'Profiles')];
    default: return [j(h, '.mozilla', 'firefox')];
  }
}

/**
 * Browser user-data dirs: [{ browser, dir }], Chromium profile layout
 * (Default / Profile N / Extensions). AI-first browsers are listed here so
 * the extension walk covers them; their presence is reported separately by
 * ai-browsers.js. Dia and ChatGPT Atlas paths are best-effort (macOS only,
 * undocumented by their vendors) — a wrong guess simply finds nothing.
 */
export function browserRoots() {
  const h = home();
  switch (platform()) {
    case 'win32': {
      const l = localAppData();
      return [
        { browser: 'Chrome', dir: j(l, 'Google', 'Chrome', 'User Data') },
        { browser: 'Edge', dir: j(l, 'Microsoft', 'Edge', 'User Data') },
        { browser: 'Brave', dir: j(l, 'BraveSoftware', 'Brave-Browser', 'User Data') },
        { browser: 'Vivaldi', dir: j(l, 'Vivaldi', 'User Data') },
        { browser: 'Arc', dir: j(l, 'Packages', 'TheBrowserCompany.Arc_ttt1ap7aakyb4', 'LocalCache', 'Local', 'Arc', 'User Data') },
        { browser: 'Comet', dir: j(l, 'Perplexity', 'Comet', 'User Data') },
      ];
    }
    case 'darwin': {
      const a = j(h, 'Library', 'Application Support');
      return [
        { browser: 'Chrome', dir: j(a, 'Google', 'Chrome') },
        { browser: 'Edge', dir: j(a, 'Microsoft Edge') },
        { browser: 'Brave', dir: j(a, 'BraveSoftware', 'Brave-Browser') },
        { browser: 'Vivaldi', dir: j(a, 'Vivaldi') },
        { browser: 'Arc', dir: j(a, 'Arc', 'User Data') },
        { browser: 'Comet', dir: j(a, 'Perplexity', 'Comet') },
        { browser: 'Dia', dir: j(a, 'Dia', 'User Data') },
        { browser: 'ChatGPT Atlas', dir: j(a, 'com.openai.atlas') },
      ];
    }
    default: {
      const c = j(h, '.config');
      return [
        { browser: 'Chrome', dir: j(c, 'google-chrome') },
        { browser: 'Chromium', dir: j(c, 'chromium') },
        { browser: 'Edge', dir: j(c, 'microsoft-edge') },
        { browser: 'Brave', dir: j(c, 'BraveSoftware', 'Brave-Browser') },
        { browser: 'Vivaldi', dir: j(c, 'vivaldi') },
      ];
    }
  }
}

const AI_BROWSERS = {
  Comet: { ref: 'perplexity.ai/comet', note: 'agentic browser — its built-in agent browses and acts on pages for you' },
  Dia: { ref: 'diabrowser.com', note: 'AI browser — the built-in assistant reads the tabs you have open' },
  'ChatGPT Atlas': { ref: 'openai.com/atlas', note: 'agentic browser — agent mode browses and acts on pages for you' },
};

/** The subset of browserRoots() whose browser is itself an AI agent. */
export function aiBrowserRoots() {
  return browserRoots().filter((r) => AI_BROWSERS[r.browser]).map((r) => ({ ...r, ...AI_BROWSERS[r.browser] }));
}
