// AI browser extensions in Chrome/Edge/Brave profiles, identified from
// their manifests, with permissions reported from the manifest itself.
import { j, listDir, isDir, readJson } from '../util/fsx.js';
import { browserRoots, firefoxProfileRoots } from '../platform.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KNOWN = require('../../data/known-agents.json');

const BROAD_HOSTS = new Set(['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*']);
const RISKY_PERMS = new Set(['tabs', 'webRequest', 'cookies', 'history', 'clipboardRead', 'scripting', 'debugger', 'nativeMessaging']);

function resolveName(dir, manifest) {
  let name = manifest.name || '';
  if (name.startsWith('__MSG_')) {
    const key = name.slice(6, -2);
    for (const loc of ['en', 'en_US', 'en_GB']) {
      const msgs = readJson(j(dir, '_locales', loc, 'messages.json')).value;
      const hit = msgs && (msgs[key] || msgs[key.toLowerCase()]);
      if (hit && hit.message) return hit.message;
    }
  }
  return name;
}

export default {
  id: 'browser-extensions',
  name: 'AI browser extensions',
  run() {
    const out = [];
    const nameHints = KNOWN.browserExtensionNames;
    for (const { browser, dir } of browserRoots()) {
      if (!isDir(dir)) continue;
      const profiles = listDir(dir).filter((p) => p === 'Default' || /^Profile /.test(p));
      for (const profile of profiles) {
        const extRoot = j(dir, profile, 'Extensions');
        if (!isDir(extRoot)) continue;
        for (const id of listDir(extRoot)) {
          const versions = listDir(j(extRoot, id)).filter((v) => isDir(j(extRoot, id, v)));
          if (!versions.length) continue;
          const vdir = j(extRoot, id, versions.sort().slice(-1)[0]);
          const manifest = readJson(j(vdir, 'manifest.json')).value;
          if (!manifest) continue;
          const name = resolveName(vdir, manifest);
          const lower = name.toLowerCase();
          if (!nameHints.some((h) => lower.includes(h))) continue;
          const perms = [...(manifest.permissions || []), ...(manifest.optional_permissions || [])].filter((p) => typeof p === 'string');
          const hosts = [...(manifest.host_permissions || []), ...perms.filter((p) => p.includes('://') || p === '<all_urls>')];
          const exposures = ['NETWORK'];
          const notes = [];
          if (hosts.some((x) => BROAD_HOSTS.has(x))) { exposures.push('BROAD-WEB'); notes.push('can read and modify every website you visit'); }
          const risky = perms.filter((p) => RISKY_PERMS.has(p));
          if (risky.length) notes.push('permissions: ' + risky.join(', '));
          if (risky.includes('nativeMessaging')) exposures.push('EXECUTES');
          out.push({
            detector: 'browser-extensions', kind: 'extension',
            name: `${name} (${browser}${profile === 'Default' ? '' : ' · ' + profile})`,
            origin: { type: 'store', ref: id },
            exposures,
            evidence: [{ file: vdir, note: 'installed browser extension' }],
            confidence: 'medium',
            notes,
          });
        }
      }
    }

    // Firefox stores addon metadata (incl. granted permissions) per profile
    // in extensions.json — no manifest walking needed.
    for (const root of firefoxProfileRoots()) {
      if (!isDir(root)) continue;
      for (const profile of listDir(root).filter((p) => isDir(j(root, p)))) {
        const extFile = j(root, profile, 'extensions.json');
        const data = readJson(extFile).value;
        if (!data || !Array.isArray(data.addons)) continue;
        for (const a of data.addons) {
          if (a.type !== 'extension' || a.location !== 'app-profile') continue; // user-installed only
          const name = (a.defaultLocale && a.defaultLocale.name) || a.id || '';
          const lower = name.toLowerCase();
          if (!nameHints.some((hint) => lower.includes(hint))) continue;
          const perms = (a.userPermissions && a.userPermissions.permissions) || [];
          const origins = (a.userPermissions && a.userPermissions.origins) || [];
          const exposures = ['NETWORK'];
          const notes = [];
          if (origins.some((x) => BROAD_HOSTS.has(x))) { exposures.push('BROAD-WEB'); notes.push('can read and modify every website you visit'); }
          const risky = perms.filter((p) => RISKY_PERMS.has(p));
          if (risky.length) notes.push('permissions: ' + risky.join(', '));
          if (risky.includes('nativeMessaging')) exposures.push('EXECUTES');
          if (a.active === false) notes.push('currently disabled');
          out.push({
            detector: 'browser-extensions', kind: 'extension',
            name: `${name} (Firefox · ${profile})`,
            origin: { type: 'store', ref: a.id },
            exposures,
            evidence: [{ file: extFile, note: 'installed browser extension (extensions.json)' }],
            confidence: 'medium',
            notes,
          });
        }
      }
    }
    return out;
  },
};
