// Secret detection by SHAPE only. Geiger reports that a credential exists,
// where it lives, and what kind it looks like — never any part of its value.

const SHAPES = [
  { shape: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{10,}/ },
  { shape: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { shape: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { shape: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { shape: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { shape: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { shape: 'Stripe live key', re: /\bsk_live_[A-Za-z0-9]{16,}/ },
  { shape: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { shape: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/ },
];

const KEYNAME_RE = /(api[_-]?key|token|secret|passwd|password|credential|auth)/i;

/** Classify a single string value. Returns shape label or null. */
export function classifyValue(value) {
  if (typeof value !== 'string' || value.length < 8) return null;
  for (const s of SHAPES) if (s.re.test(value)) return s.shape;
  return null;
}

/**
 * Scan an env-style object ({ KEY: value }) for secret-shaped material.
 * Returns [{ key, shape }] — values are never included.
 */
export function scanEnvObject(env) {
  const hits = [];
  if (!env || typeof env !== 'object') return hits;
  for (const [key, value] of Object.entries(env)) {
    const shape = classifyValue(value);
    if (shape) { hits.push({ key, shape }); continue; }
    if (KEYNAME_RE.test(key) && typeof value === 'string' && value.length >= 8) {
      hits.push({ key, shape: 'opaque value under a credential-named key' });
    }
  }
  return hits;
}

/**
 * Scan raw config text for secret shapes (for formats we parse only partially).
 * Returns unique shape labels found — never positions, never values.
 */
export function scanText(text) {
  const found = new Set();
  if (typeof text !== 'string') return [];
  for (const s of SHAPES) if (s.re.test(text)) found.add(s.shape);
  return [...found];
}

/** Defense-in-depth: strip anything secret-shaped from any outbound string. */
export function redact(text) {
  let out = String(text);
  for (const s of SHAPES) out = out.replace(new RegExp(s.re.source, 'g'), '[REDACTED:' + s.shape + ']');
  return out;
}
