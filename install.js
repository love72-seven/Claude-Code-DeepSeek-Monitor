#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const PLUGIN_DIR = path.join(CLAUDE_DIR, 'plugins', 'claude-hud');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills', 'usage');
const SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const PKG = __dirname;
const NODE = process.execPath;

const C = { r:'\x1b[0m', b:'\x1b[1m', g:'\x1b[32m', c:'\x1b[36m', y:'\x1b[33m', d:'\x1b[2m' };
function log(l,m) { console.log(`  ${C.c}${l}${C.r} ${m}`); }
function ok(m) { console.log(`${C.g}✅${C.r} ${m}`); }

console.log(`\n${C.b}${C.c}╔════════════════════════════════════╗`);
console.log(`║  Claude Code DeepSeek Monitor     ║`);
console.log(`╚════════════════════════════════════╝${C.r}\n`);

try {
  const hudDest = path.join(CLAUDE_DIR, 'plugins', 'cache', 'deepseek-monitor', '1.0.0');
  const scriptDir = path.join(CLAUDE_DIR, 'plugins', 'custom', 'deepseek-monitor', 'scripts');

  // 1. HUD
  log('📦', 'install HUD...');
  fs.mkdirSync(hudDest, { recursive: true });
  fs.cpSync(path.join(PKG, 'hud'), hudDest, { recursive: true });
  ok(`HUD → ${hudDest}`);

  // 2. Scripts
  log('📜', 'install scripts...');
  fs.mkdirSync(scriptDir, { recursive: true });
  fs.copyFileSync(path.join(PKG, 'scripts', 'query.js'), path.join(scriptDir, 'query.js'));
  ok(`scripts → ${scriptDir}`);

  // 3. Skill
  log('🔧', 'install /usage...');
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  fs.cpSync(path.join(PKG, 'skills', 'usage'), SKILLS_DIR, { recursive: true });
  ok(`/usage → ${SKILLS_DIR}`);

  // 4. HUD config
  log('⚙️', 'configure HUD...');
  fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  // 写入版本号
  const versionCacheDir = path.join(HOME, '.claude', 'deepseek-cache');
  try { fs.mkdirSync(versionCacheDir, { recursive: true }); } catch {}
  fs.writeFileSync(path.join(versionCacheDir, 'version.txt'), '1.0.19');

  fs.writeFileSync(path.join(PLUGIN_DIR, 'config.json'), JSON.stringify({
    language:'zh', lineLayout:'compact',
    elementOrder:['project','context','deepseek','tools','agents','todos'],
    display:{showModel:true,showProject:true,showContextBar:true,showDeepSeek:true,showCost:false,showUsage:false,showTools:true,showAgents:true,showTodos:true,showDuration:true,showSessionName:false,contextValue:'both'},
  },null,2));

  // 5. statusLine
  log('🚀', 'configure statusLine...');
  const runScript = path.join(PLUGIN_DIR, 'run.mjs');
  fs.writeFileSync(runScript, [
    "import { execSync } from 'child_process';",
    "import { pathToFileURL } from 'url';",
    "let cols = 120;",
    "try {",
    "  const cmd = process.platform === 'win32' ? 'mode con 2>nul' : 'tput cols 2>/dev/null';",
    "  const out = execSync(cmd, { encoding: 'utf8', timeout: 1000 });",
    "  const m = out.match(/(\\d+)/);",
    "  if (m) cols = parseInt(m[1], 10) - 4;",
    "} catch(e) {}",
    "process.env.COLUMNS = String(Math.max(1, cols));",
    "// 自毁检测：HUD 文件不存在则自动清理",
    `const hudPath = ${JSON.stringify(path.join(hudDest, 'dist', 'index.js'))};`,
    "import { existsSync, unlinkSync, rmdirSync, readFileSync, writeFileSync, rmSync } from 'fs';",
    "import { homedir } from 'os';",
    "import { join, dirname } from 'path';",
    "if (!existsSync(hudPath)) {",
    "  const home = homedir();",
    "  try { const sp = join(home, '.claude', 'settings.json'); const s = JSON.parse(readFileSync(sp,'utf-8')); delete s.statusLine; writeFileSync(sp, JSON.stringify(s,null,2)); } catch {}",
    "  try { rmSync(join(home, '.claude', 'plugins', 'cache', 'deepseek-monitor'), {recursive:true,force:true}); } catch {}",
    "  try { rmSync(join(home, '.claude', 'plugins', 'claude-hud'), {recursive:true,force:true}); } catch {}",
    "  try { rmSync(join(home, '.claude', 'deepseek-cache'), {recursive:true,force:true}); } catch {}",
    "  process.exit(0);",
    "}",
    `const hud = await import(pathToFileURL(hudPath).href);`,
    "import { writeFileSync } from 'fs';",
    "import { homedir } from 'os';",
    "import { join } from 'path';",
    "try { writeFileSync(join(homedir(), '.claude', 'deepseek-cache', 'hud.pid'), String(process.pid)); } catch {}",
    "hud.main();",
    "",
  ].join('\n'));
  const statusCmd = `"${NODE}" "${runScript}"`;

  let settings = {};
  if (fs.existsSync(SETTINGS)) settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf-8'));
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.bak.${ts}`);
  settings.statusLine = { type: 'command', command: statusCmd };
  if (!settings.env) settings.env = {};
  if (settings.hooks) { delete settings.hooks.SessionStart; delete settings.hooks.SessionEnd; }
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  ok(`statusLine configured`);

  console.log(`\n${C.b}${C.g}  ✨ Done! Restart Claude Code.${C.r}\n`);
  console.log(`  ${C.y}/usage${C.r}          full dashboard`);
  console.log(`  ${C.y}/usage --short${C.r}   one-line\n`);

} catch(e) { console.error('❌', e.message); process.exit(1); }
