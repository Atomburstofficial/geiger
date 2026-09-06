// Claude Code: ~/.claude.json (global + per-project MCP servers),
// ~/.claude/settings.json (hooks, apiKeyHelper), plugins, skills, agents,
// and the current project's .mcp.json / .claude/settings.json.
import { j, readJson, listDir, isDir, exists } from '../util/fsx.js';
import { home } from '../platform.js';
import { findingsFromMcpFile } from './common.js';
import { scanEnvObject } from '../redact.js';
import { assessMcpServer } from '../engine.js';

export default {
  id: 'claude-code',
  name: 'Claude Code',
  run(ctx) {
    const h = home();
    const out = [];
    const root = j(h, '.claude');
    const globalCfg = j(h, '.claude.json');

    const cfg = readJson(globalCfg);
    const installed = exists(root) || cfg.error !== 'missing';
    if (!installed) return out;

    out.push({
      detector: 'claude-code', kind: 'agent', name: 'Claude Code',
      origin: { type: 'registry', ref: '@anthropic-ai/claude-code' },
      exposures: ['EXECUTES', 'BROAD-FILESYSTEM', 'NETWORK'],
      evidence: [{ file: root, note: 'agent home directory' }],
      notes: ['a coding agent that runs shell commands as this user'],
    });

    if (cfg.value) {
      for (const [name, server] of Object.entries(cfg.value.mcpServers || {})) {
        const f = assessMcpServer(name, server, globalCfg, 'claude-code', 'Claude Code · global');
        const hits = scanEnvObject(server && server.env);
        if (hits.length) { f.exposures.push('HOLDS-SECRETS'); f.secrets = hits.map((x) => ({ ...x, file: globalCfg })); }
        out.push(f);
      }
      const projects = cfg.value.projects || {};
      for (const [proj, pval] of Object.entries(projects)) {
        for (const [name, server] of Object.entries((pval && pval.mcpServers) || {})) {
          const f = assessMcpServer(name, server, globalCfg, 'claude-code', 'project ' + proj);
          const hits = scanEnvObject(server && server.env);
          if (hits.length) { f.exposures.push('HOLDS-SECRETS'); f.secrets = hits.map((x) => ({ ...x, file: globalCfg })); }
          out.push(f);
        }
      }
    }

    // settings: hooks are standing command execution; apiKeyHelper runs a script
    for (const sf of [j(root, 'settings.json'), j(root, 'settings.local.json'),
                      ctx.cwd ? j(ctx.cwd, '.claude', 'settings.json') : null,
                      ctx.cwd ? j(ctx.cwd, '.claude', 'settings.local.json') : null].filter(Boolean)) {
      const s = readJson(sf);
      if (!s.value) continue;
      const hooks = s.value.hooks || {};
      const hookEvents = Object.keys(hooks);
      if (hookEvents.length) {
        out.push({
          detector: 'claude-code', kind: 'hook', name: `hooks: ${hookEvents.join(', ')}`,
          origin: { type: 'local', ref: sf },
          exposures: ['EXECUTES'],
          evidence: [{ file: sf, note: 'shell commands that run automatically on agent events' }],
          notes: ['hooks execute without a prompt each time their event fires'],
        });
      }
      if (s.value.apiKeyHelper) {
        out.push({
          detector: 'claude-code', kind: 'config', name: 'apiKeyHelper script',
          origin: { type: 'local', ref: String(s.value.apiKeyHelper).slice(0, 120) },
          exposures: ['EXECUTES', 'HOLDS-SECRETS'],
          evidence: [{ file: sf, note: 'script invoked to produce credentials' }],
        });
      }
    }

    // project-level .mcp.json
    if (ctx.cwd) out.push(...findingsFromMcpFile(j(ctx.cwd, '.mcp.json'), 'claude-code', 'project .mcp.json'));

    // plugins / skills / agents inventories
    const inv = readJson(j(root, 'plugins', 'installed_plugins.json'));
    if (inv.value && inv.value.plugins) {
      for (const [key, installs] of Object.entries(inv.value.plugins)) {
        const [pluginName, marketplace] = key.split('@');
        const first = Array.isArray(installs) ? installs[0] : installs;
        out.push({
          detector: 'claude-code', kind: 'plugin', name: pluginName,
          origin: { type: 'git', ref: marketplace || key },
          exposures: ['EXECUTES'],
          evidence: [{ file: (first && first.installPath) || inv.file, note: 'installed Claude Code plugin' + (first && first.version ? ' v' + first.version : '') }],
          notes: ['plugins contribute commands, skills, and hooks to the agent'],
        });
      }
    }
    for (const [dir, kind, note] of [[j(root, 'skills'), 'skill', 'instructions loaded into the agent'], [j(root, 'agents'), 'config', 'custom subagent definition']]) {
      if (!isDir(dir)) continue;
      for (const name of listDir(dir).filter((n) => !n.startsWith('.')).slice(0, 50)) {
        out.push({
          detector: 'claude-code', kind, name,
          origin: { type: 'local', ref: j(dir, name) },
          exposures: [],
          evidence: [{ file: j(dir, name), note }],
          confidence: 'high',
        });
      }
    }
    return out;
  },
};
