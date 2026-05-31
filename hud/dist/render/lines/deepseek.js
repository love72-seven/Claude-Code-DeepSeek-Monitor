import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { dim, label, yellow, red, RESET } from '../colors.js';
import { t } from '../../i18n/index.js';
const DS_INPUT_PRICE = 3;
const DS_CACHE_PRICE = 0.025;
const DS_OUTPUT_PRICE = 6;
const REFRESH_SEC = 5; // 5 秒刷新
const ALERT_DEFAULT = 0.5;
const CACHE_DIR = path.join(os.homedir(), '.claude', 'deepseek-cache');
const VERSION_FILE = path.join(CACHE_DIR, 'version.txt');
function readVersion() {
    try {
        return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
    }
    catch {
        return '';
    }
}
try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}
catch { }
const BALANCE_CACHE = path.join(CACHE_DIR, 'balance.txt');
const COST_CACHE = path.join(CACHE_DIR, 'last-cost.txt');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
// 自给自足：缓存过期时 HUD 自己查余额
function getBalance() {
    let cached = null;
    let age = Infinity;
    try {
        const stat = fs.statSync(BALANCE_CACHE);
        age = (Date.now() - stat.mtimeMs) / 1000;
        cached = fs.readFileSync(BALANCE_CACHE, 'utf-8').trim();
    }
    catch { }
    // 缓存过期 → 同步拉取（防止并发：用 mtime 做简单锁）
    if (age > REFRESH_SEC) {
        // touch 文件防止并发请求
        try {
            fs.utimesSync(BALANCE_CACHE, new Date(), new Date());
        }
        catch { }
        try {
            let apiKey = '';
            try {
                const s = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
                apiKey = s?.env?.ANTHROPIC_AUTH_TOKEN || '';
            }
            catch { }
            if (!apiKey) {
                try {
                    const s = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf-8'));
                    apiKey = s?.env?.ANTHROPIC_AUTH_TOKEN || '';
                }
                catch { }
            }
            if (apiKey) {
                const body = execSync(`curl -s --max-time 3 https://api.deepseek.com/user/balance -H "Authorization: Bearer ${apiKey}"`, { encoding: 'utf8', timeout: 4000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
                if (body) {
                    const j = JSON.parse(body);
                    const b = (j.balance_infos || [{}])[0];
                    cached = [b.total_balance || '0', b.topped_up_balance || '0', b.granted_balance || '0', j.is_available ? 'true' : 'false'].join(' ');
                    fs.writeFileSync(BALANCE_CACHE, cached);
                    age = 0;
                }
            }
        }
        catch { }
    }
    if (!cached)
        return null;
    const num = parseFloat(cached);
    if (isNaN(num))
        return null;
    return { value: num, str: num.toFixed(2), fresh: age < 120 };
}
function readLastCumCost() {
    try {
        const raw = fs.readFileSync(COST_CACHE, 'utf-8').trim();
        const num = parseFloat(raw);
        return isNaN(num) ? null : num;
    }
    catch {
        return null;
    }
}
function writeCumCost(v) {
    try {
        fs.writeFileSync(COST_CACHE, v.toFixed(6));
    }
    catch { }
}
function formatCost(n) {
    if (n < 0.0001)
        return '¥0';
    if (n < 0.01)
        return `¥${n.toFixed(4)}`;
    if (n < 1)
        return `¥${n.toFixed(3)}`;
    return `¥${n.toFixed(2)}`;
}
export function renderDeepSeekLine(ctx) {
    if (ctx.config?.display?.showDeepSeek !== true)
        return null;
    const parts = [];
    const st = ctx.transcript.sessionTokens;
    let cumCost = 0;
    if (st) {
        const maxCache = Math.min(st.cacheReadTokens, st.inputTokens);
        const uncached = st.inputTokens - maxCache;
        cumCost =
            (uncached / 1_000_000) * DS_INPUT_PRICE +
                (maxCache / 1_000_000) * DS_CACHE_PRICE +
                (st.outputTokens / 1_000_000) * DS_OUTPUT_PRICE;
    }
    const lastCum = readLastCumCost();
    const delta = lastCum !== null && cumCost > lastCum ? cumCost - lastCum : null;
    if (cumCost > 0)
        writeCumCost(cumCost);
    const alertThreshold = ctx.config?.display?.deepseekAlertThreshold ?? ALERT_DEFAULT;
    if (cumCost > 0) {
        const alert = delta !== null && delta > alertThreshold;
        const deltaStr = delta !== null && delta > 0.0001 ? `+${formatCost(delta)}` : '';
        const cumStr = formatCost(cumCost);
        const costStr = alert
            ? `${red(deltaStr)} ${dim(cumStr)}`
            : deltaStr
                ? `${yellow(deltaStr)} ${dim(cumStr)}`
                : yellow(cumStr);
        parts.push(`${label(t('label.cost'))} ${costStr}`);
    }
    function rainbow(n) {
        if (n <= 0.5)
            return '\x1b[38;5;196m';
        if (n <= 1)
            return '\x1b[38;5;202m';
        if (n <= 3)
            return '\x1b[38;5;208m';
        if (n <= 5)
            return '\x1b[38;5;214m';
        if (n <= 8)
            return '\x1b[38;5;220m';
        if (n <= 12)
            return '\x1b[38;5;190m';
        if (n <= 20)
            return '\x1b[38;5;82m';
        if (n <= 50)
            return '\x1b[38;5;51m';
        return '\x1b[38;5;33m';
    }
    const bal = getBalance();
    if (bal) {
        const color = rainbow(bal.value);
        const warn = bal.fresh ? '' : ` ${red('⚠')}`;
        // 显示缓存年龄
        let age = '';
        try {
            const s = fs.statSync(BALANCE_CACHE);
            age = ` ${dim(Math.round((Date.now() - s.mtimeMs) / 1000) + 's')}`;
        }
        catch { }
        parts.push(`${label(t('label.balance'))} ${color}¥${bal.str}${RESET}${warn}${age}`);
    }
    const ver = readVersion();
    if (ver)
        parts.push(`${dim('v' + ver)}`);
    if (parts.length === 0)
        return null;
    return parts.join('  ');
}
//# sourceMappingURL=deepseek.js.map