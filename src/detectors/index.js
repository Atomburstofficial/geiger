// Detector registry. Adding an ecosystem = one module + one line here.
import claudeCode from './claude-code.js';
import mcpHosts from './mcp-hosts.js';
import otherAgents from './other-agents.js';
import vscodeExtensions from './vscode-extensions.js';
import npmGlobal from './npm-global.js';
import browserExtensions from './browser-extensions.js';

export const detectors = [
  claudeCode,
  mcpHosts,
  otherAgents,
  vscodeExtensions,
  npmGlobal,
  browserExtensions,
];
