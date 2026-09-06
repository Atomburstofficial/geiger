// MCP-hosting apps with well-known config locations:
// Claude Desktop, Cursor, Windsurf, VS Code (user-level mcp.json).
import { j } from '../util/fsx.js';
import { home, appData } from '../platform.js';
import { findingsFromMcpFile } from './common.js';

export default {
  id: 'mcp-hosts',
  name: 'MCP host applications',
  run(ctx) {
    const h = home();
    const files = [
      { file: j(appData(), 'Claude', 'claude_desktop_config.json'), label: 'Claude Desktop' },
      { file: j(h, '.cursor', 'mcp.json'), label: 'Cursor · global' },
      { file: j(h, '.codeium', 'windsurf', 'mcp_config.json'), label: 'Windsurf' },
      { file: j(appData(), 'Code', 'User', 'mcp.json'), label: 'VS Code · user' },
      { file: j(appData(), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'), label: 'Cline' },
      { file: j(appData(), 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json'), label: 'Roo Code' },
      { file: j(h, '.continue', 'config.json'), label: 'Continue' },
      { file: j(h, '.config', 'zed', 'settings.json'), label: 'Zed', key: 'context_servers' },
      { file: j(appData(), 'Zed', 'settings.json'), label: 'Zed', key: 'context_servers' },
    ];
    for (const dir of (ctx && ctx.paths) || []) {
      files.push({ file: j(dir, '.vscode', 'mcp.json'), label: 'VS Code · project ' + dir, key: 'servers' });
      files.push({ file: j(dir, '.cursor', 'mcp.json'), label: 'Cursor · project ' + dir });
    }
    const out = [];
    for (const { file, label, key } of files) {
      const found = findingsFromMcpFile(file, 'mcp-hosts', label, key || 'mcpServers');
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
