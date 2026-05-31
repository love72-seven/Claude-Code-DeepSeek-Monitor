#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const HOME = os.homedir();

console.log('\n🧹 卸载 DeepSeek Monitor...\n');

function rm(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; }
}

let ok = 0, fail = 0;
function step(label, fn) {
  try { fn(); console.log(`  ✅ ${label}`); ok++; } catch(e) { console.log(`  ⚠️ ${label}: ${e.message}`); fail++; }
}

// 清理 settings.json 中的 statusLine 和 hooks
step('清理 settings.json', () => {
  const sp = path.join(HOME, '.claude', 'settings.json');
  if (fs.existsSync(sp)) {
    const s = JSON.parse(fs.readFileSync(sp, 'utf-8'));
    delete s.statusLine;
    if (s.hooks) { delete s.hooks.SessionStart; delete s.hooks.SessionEnd; }
    fs.writeFileSync(sp, JSON.stringify(s, null, 2));
  }
});

// 杀 HUD + daemon
step('停止 HUD 进程', () => {
  try {
    const pidFile = path.join(HOME, '.claude', 'deepseek-cache', 'hud.pid');
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      try { process.kill(pid); } catch {}
      fs.unlinkSync(pidFile);
    }
  } catch {}
  try {
    if (process.platform === 'win32') {
      require('child_process').execSync('taskkill /f /fi "IMAGENAME eq node.exe" 2>nul', { stdio: 'ignore' });
    } else {
      require('child_process').execSync('pkill -f "run.mjs" 2>/dev/null || true', { stdio: 'ignore' });
    }
  } catch {}
});

// 删除所有安装的文件
const dirs = [
  path.join(HOME, '.claude', 'plugins', 'cache', 'deepseek-monitor'),
  path.join(HOME, '.claude', 'plugins', 'custom', 'deepseek-monitor'),
  path.join(HOME, '.claude', 'plugins', 'claude-hud'),
  path.join(HOME, '.claude', 'skills', 'usage'),
  path.join(HOME, '.claude', 'deepseek-cache'),
];
for (const d of dirs) {
  step(`删除 ${d.replace(HOME, '~')}`, () => rm(d));
}

console.log(`\n  ✨ 卸载完成 (${ok} 成功, ${fail} 跳过)\n`);
