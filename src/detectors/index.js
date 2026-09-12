// Detector registry. Adding an ecosystem = one module + one line here.
import claudeCode from './claude-code.js';
import mcpHosts from './mcp-hosts.js';
import otherAgents from './other-agents.js';
import vscodeExtensions from './vscode-extensions.js';
import npmGlobal from './npm-global.js';
import browserExtensions from './browser-extensions.js';
import jetbrains from './jetbrains.js';
import aiApps from './ai-apps.js';
import aiBrowsers from './ai-browsers.js';
import hooks from './hooks.js';

export const detectors = [
  claudeCode,
  mcpHosts,
  aiApps,
  otherAgents,
  hooks,
  vscodeExtensions,
  npmGlobal,
  aiBrowsers,
  browserExtensions,
  jetbrains,
];
