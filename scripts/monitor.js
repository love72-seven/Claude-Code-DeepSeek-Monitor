#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const HOME = os.homedir();

const args = process.argv.slice(2);

// --uninstall
if (args.includes('--uninstall') || args.includes('uninstall')) {
  console.log('\n🧹 DeepSeek Monitor 卸载\n');

  const dirs = [
    ['HUD 插件',   path.join(HOME, '.claude', 'plugins', 'cache', 'deepseek-monitor')],
    ['脚本',       path.join(HOME, '.claude', 'plugins', 'custom', 'deepseek-monitor')],
    ['HUD 配置',   path.join(HOME, '.claude', 'plugins', 'claude-hud')],
    ['/usage',     path.join(HOME, '.claude', 'skills', 'usage')],
    ['缓存',       path.join(HOME, '.claude', 'deepseek-cache')],
  ];

  // 杀 HUD 进程
  try {
    const pidFile = path.join(HOME, '.claude', 'deepseek-cache', 'hud.pid');
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf-8').trim();
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F 2>nul`, { stdio: 'ignore' });
      } else {
        try { process.kill(+pid); } catch {}
      }
    }
  } catch {}

  for (const [label, p] of dirs) {
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
  process.exit(0);
}

// --short / --refresh 等传给 query.js
const script = path.join(HOME, '.claude', 'plugins', 'custom', 'deepseek-monitor', 'scripts', 'query.js');
try {
  execSync(`node "${script}" ${args.map(a => `"${a}"`).join(' ')}`, { stdio: 'inherit' });
} catch {
  console.log('请先安装: npm install -g claude-code-deepseek-monitor');
  process.exit(1);
}
