#!/usr/bin/env node
// 独立卸载脚本 — npm uninstall 失败时可以手动运行
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HOME = require('os').homedir();

console.log('\n🧹 DeepSeek Monitor 卸载工具\n');

const dirs = [
  [path.join(HOME, '.claude', 'plugins', 'cache', 'deepseek-monitor'), 'HUD 文件'],
  [path.join(HOME, '.claude', 'plugins', 'custom', 'deepseek-monitor'), '脚本'],
  [path.join(HOME, '.claude', 'plugins', 'claude-hud'), 'HUD 配置'],
  [path.join(HOME, '.claude', 'skills', 'usage'), '/usage 命令'],
  [path.join(HOME, '.claude', 'deepseek-cache'), '缓存'],
];

// 杀进程
try { execSync('pkill -f "run.mjs|balance-daemon" 2>/dev/null || true', { stdio: 'ignore' }); } catch {}

for (const [p, label] of dirs) {
  try { fs.rmSync(p, { recursive: true, force: true }); console.log(`  ✅ ${label}`); }
  catch { console.log(`  ⚠️ ${label} (跳过)`); }
}

// 清理 settings.json
const sp = path.join(HOME, '.claude', 'settings.json');
try {
  const s = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  delete s.statusLine;
  if (s.hooks) { delete s.hooks.SessionStart; delete s.hooks.SessionEnd; }
  fs.writeFileSync(sp, JSON.stringify(s, null, 2));
  console.log('  ✅ settings.json');
} catch { console.log('  ⚠️ settings.json (跳过)'); }

console.log('\n  ✨ 完成\n');
