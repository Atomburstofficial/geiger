// MCP-hosting apps with well-known config locations:
// Claude Desktop, Cursor, Windsurf, VS Code (user-level mcp.json).
import { j } from '../util/fsx.js';
import { home, appData } from '../platform.js';
import { findingsFromMcpFile } from './common.js';

export default {
  id: 'mcp-hosts',
  name: 'MCP host applications',
  run() {
    const h = home();
    const files = [
      { file: j(appData(), 'Claude', 'claude_desktop_config.json'), label: 'Claude Desktop' },
      { file: j(h, '.cursor', 'mcp.json'), label: 'Cursor · global' },
      { file: j(h, '.codeium', 'windsurf', 'mcp_config.json'), label: 'Windsurf' },
      { file: j(appData(), 'Code', 'User', 'mcp.json'), label: 'VS Code · user' },
    ];
    const out = [];
    for (const { file, label } of files) {
      const found = findingsFromMcpFile(file, 'mcp-hosts', label);
      // VS Code's user mcp.json nests under "servers" in some versions
      if (!found.length && label.startsWith('VS Code')) {
        out.push(...findingsFromMcpFile(file, 'mcp-hosts', label, 'servers'));
      } else {
        out.push(...found);
      }
    }
    return out;
  },
};
