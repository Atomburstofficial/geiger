// Read-only filesystem helpers. Geiger never writes outside its own --out file.
import fs from 'node:fs';
import path from 'node:path';

/** Read a file as UTF-8, or null. Never throws. */
export function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

/** True if a path exists. Never throws. */
export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

/** List directory entries (names), or []. Never throws. */
export function listDir(p) {
  try { return fs.readdirSync(p); } catch { return []; }
}

/** True if path is a directory. Never throws. */
export function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

/**
 * Tolerant JSON parse: strips // and / * * / comments and trailing commas
 * (agent configs in the wild are frequently JSON-with-comments).
 * Returns { value, error } — never throws.
 */
export function parseJsonTolerant(text) {
  if (text == null) return { value: null, error: 'missing' };
  try {
    return { value: JSON.parse(text), error: null };
  } catch {
    try {
      const stripped = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:"'])\/\/[^\n]*/g, '$1')
        .replace(/,\s*([}\]])/g, '$1');
      return { value: JSON.parse(stripped), error: null };
    } catch (e2) {
      try {
        // Hand-edited Windows configs often contain lone backslashes in
        // paths. Escape any backslash that does not begin a valid JSON
        // escape sequence, then retry.
        const fixedSlashes = text.replace(/\\(?![\\/"bfnrtu])/g, '\\\\');
        return { value: JSON.parse(fixedSlashes), error: null };
      } catch {
        return { value: null, error: 'unparseable: ' + String(e2.message).slice(0, 80) };
      }
    }
  }
}

/** Read + tolerant-parse a JSON file. Returns { value, error, file }. */
export function readJson(file) {
  const text = readText(file);
  if (text == null || text.trim() === '') return { value: null, error: 'missing', file };
  const r = parseJsonTolerant(text);
  return { value: r.value, error: r.error, file };
}

/** Join that tolerates null segments. */
export function j(...parts) {
  return path.join(...parts.filter(Boolean));
}
