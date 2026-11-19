import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SGE = 'https://www.sge.com.cn';
const BRANDS = {
  chowtaifook: { name: '周大福', url: 'https://www.hjjg.net/chowtaifook/history.html' },
  laofengxiang: { name: '老凤祥', url: 'https://www.hjjg.net/laofengxiang/history.html' },
  zhouliufu: { name: '周六福', url: 'https://www.hjjg.net/zhouliufu/history.html' }
};

const num = (value) => {
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
};

function dateOf(input) {
  if (typeof input === 'number' || /^\d{12,}$/.test(String(input))) {
    const t = Number(input);
    const d = new Date(t < 1e11 ? t * 1000 : t);
    return Number.isNaN(d.valueOf()) ? null : d.toISOString().slice(0, 10);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(String(input)) ? String(input) : null;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'user-agent': 'Mozilla/5.0', accept: '*/*', ...options.headers },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function fetchSge(path, method = 'GET') {
  const text = await fetchText(SGE + path, {
    method,
    headers: {
      referer: SGE + '/sjzx/mrhq',
      origin: SGE,
      accept: 'application/json, text/javascript, */*',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    ...(method === 'POST' ? { body: 'instid=Au99.99' } : {})
  });
  return JSON.parse(text);
}

export function parseDaily(data) {
  const rows = Array.isArray(data.time) ? data.time : [];
  const points = rows.map((row) => {
    if (!Array.isArray(row) || row.length < 5) return null;
    const date = dateOf(row[0]);
    const open = num(row[1]), close = num(row[2]), low = num(row[3]), high = num(row[4]);
    return date && open && close && low && high && low <= high ? { date, open, close, low, high } : null;
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 5) throw new Error('SGE daily history has too few valid rows');
  return { ok: true, source: '上海黄金交易所', symbol: 'Au99.99', points };
}

function clockMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value));
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

// SGE returns a complete night-plus-day minute grid, including future slots.
function tradingMinute(value, clampToSession = false) {
  const minute = clockMinutes(value);
  if (minute === null) return null;
  if (minute >= 20 * 60) return minute - 20 * 60;
  if (minute <= 2 * 60 + 30) return minute + 4 * 60;
  if (minute >= 9 * 60 && minute <= 15 * 60 + 30) return 391 + minute - 9 * 60;
  if (!clampToSession) return null;
  return minute < 9 * 60 ? 390 : 781;
}

export function parseIntraday(data) {
  const times = Array.isArray(data.times) ? data.times : [];
  const values = Array.isArray(data.data) ? data.data : [];
  const quoted = /(\d{1,2}:\d{2})(?::\d{2})?\s*$/.exec(String(data.delaystr || ''));
  const cutoff = quoted ? tradingMinute(quoted[1], true) : null;
  if (cutoff === null) throw new Error('SGE intraday quote time unavailable');
  const points = times.map((time, i) => ({ time: String(time), close: num(values[i]), minute: tradingMinute(time) }))
    .filter((p) => p.minute !== null && p.minute <= cutoff && p.close !== null)
    .sort((a, b) => a.minute - b.minute)
    .map(({ time, close }) => ({ time, close }));
  if (points.length < 5) throw new Error('SGE intraday history has too few valid rows');
  return { ok: true, source: '上海黄金交易所', quoteTime: String(data.delaystr || ''), points };
}

export function parseBrand(html, brand) {
  if (!BRANDS[brand]) throw new Error('Unknown brand');
  // Site listing order: brand, ornament gold quote, platinum quote, date.
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
  const title = BRANDS[brand].name;
  const entry = new RegExp(title + '\\s*(\\d{3,4}(?:\\.\\d+)?)\\s*元\\/克\\s*\\d{3,4}(?:\\.\\d+)?\\s*元\\/克\\s*(20\\d{2}-\\d{1,2}-\\d{1,2})', 'g');
  const points = Array.from(visible.matchAll(entry), (match) => ({
    date: match[2].replace(/-(\d)(?=-|$)/g, '-0$1'),
    close: num(match[1])
  })).filter((p) => p.close && p.close > 100 && p.close < 10000)
    .sort((a, b) => a.date.localeCompare(b.date));
  const deduped = points.filter((p, i) => p.date !== points[i - 1]?.date);
  if (deduped.length < 2) throw new Error(title + ' history has too few valid rows');
  return { ok: true, sourceLabel: '黄金价格网公开资料', brand: title, points: deduped };
}

export function parseXauPrice(data) {
  const price = num(data?.price);
  const updated = Date.parse(data?.updatedAt);
  const age = Date.now() - updated;
  if (data?.symbol !== 'XAU' || data?.currency !== 'USD' || price === null ||
      !Number.isFinite(updated) || age < -5 * 60 * 1000 || age > 7 * 86400000) {
    throw new Error('Invalid or outdated XAU/USD quote');
  }
  return { ok: true, source: 'Gold API', symbol: 'XAU', currency: 'USD',
    price, updatedAt: new Date(updated).toISOString() };
}


const EASTMONEY_XAU = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

async function fetchEastmoneyXau(interval, limit) {
  const url = new URL(EASTMONEY_XAU);
  for (const [key, value] of Object.entries({
    secid: '122.XAU', fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56',
    klt: String(interval), fqt: '0', beg: '0', end: '20500101', lmt: String(limit)
  })) url.searchParams.set(key, value);
  return JSON.parse(await fetchText(url.toString(), {
    headers: { referer: 'https://quote.eastmoney.com/option/122.XAU.html', accept: 'application/json' }
  }));
}

export function parseXauHistory(payload, intraday = false) {
  const data = payload?.data;
  if (payload?.rc !== 0 || String(data?.code || '').toUpperCase() !== 'XAU' ||
      !Array.isArray(data.klines)) throw new Error('Eastmoney XAU history unavailable');
  const rows = data.klines.map((row) => {
    if (typeof row !== 'string') return null;
    const values = row.split(',');
    const stamp = values[0] || '';
    if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(stamp) ||
        (intraday && stamp.length !== 16) || (!intraday && stamp.length !== 10)) return null;
    const open = num(values[1]), close = num(values[2]);
    const high = num(values[3]), low = num(values[4]);
    if (!open || !close || !high || !low || high < low ||
        open > high || open < low || close > high || close < low) return null;
    return intraday
      ? { date: stamp.slice(0, 10), time: stamp.slice(11), open, close, high, low }
      : { date: stamp, open, close, high, low };
  }).filter(Boolean).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const deduped = rows.filter((row, i) => i === 0 ||
    row.date !== rows[i - 1].date || row.time !== rows[i - 1].time);
  const latest = deduped.at(-1)?.date;
  const points = intraday ? deduped.filter((row) => row.date === latest) : deduped;
  if (points.length < 5) throw new Error('Eastmoney XAU history has too few valid bars');
  return {
    ok: true, source: '东方财富 黄金/美元', symbol: 'XAU/USD',
    interval: intraday ? '5m' : '1d',
    quoteTime: points.at(-1).date + (intraday ? ' ' + points.at(-1).time : ''),
    points
  };
}


async function fetchXaus(path) {
  return JSON.parse(await fetchText('https://xaus.com/api/v1/' + path, {
    headers: { accept: 'application/json' }
  }));
}

export function parseXausHistory(data) {
  if (data?.symbol !== 'XAUUSD' || !Array.isArray(data.points)) {
    throw new Error('XAUS XAUUSD daily history unavailable');
  }
  const points = data.points.map((row) => {
    const date = dateOf(row?.d), close = num(row?.c), high = num(row?.h), low = num(row?.l);
    if (!date || !close || !high || !low || high < low || close > high || close < low) return null;
    const point = { date, close, high, low };
    const open = num(row?.o);
    if (open && open >= low && open <= high) point.open = open;
    return point;
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  const unique = points.filter((row, i) => i === 0 || row.date !== points[i - 1].date);
  if (unique.length < 5) throw new Error('XAUS XAUUSD daily history unexpectedly small');
  return { ok: true, source: 'XAUS XAU/USD 参考行情', symbol: 'XAU/USD',
    interval: '1d', quoteTime: unique.at(-1).date, points: unique };
}

export function parseXausIntraday(data) {
  if (!Array.isArray(data?.points)) throw new Error('XAUS intraday unavailable');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const points = data.points.map((row) => {
    const timestamp = typeof row?.t === 'number'
      ? new Date(row.t < 1e11 ? row.t * 1000 : row.t)
      : new Date(row?.t);
    const close = num(row?.p);
    if (!close || !Number.isFinite(timestamp.valueOf())) return null;
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value }) => [type, value]));
    return { date: parts.year + '-' + parts.month + '-' + parts.day,
      time: parts.hour + ':' + parts.minute, close };
  }).filter(Boolean).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const latestDay = points.at(-1)?.date;
  const latest = points.filter((point) => point.date === latestDay);
  const unique = latest.filter((point, i) => i === 0 || point.time !== latest[i - 1].time);
  if (unique.length < 5) throw new Error('XAUS intraday series has too few samples');
  return { ok: true, source: 'XAUS 5分钟参考采样', symbol: 'XAU/USD',
    interval: 'sampled-5m', quoteTime: latestDay + ' ' + unique.at(-1).time,
    points: unique };
}
async function update(file, producer, hasSeries = true) {
  const path = new URL('../public/data/' + file + '.json', import.meta.url);
  try {
    const data = await producer();
    // Don't publish an accidentally truncated quote series.
    if (hasSeries && (!Array.isArray(data.points) || data.points.length < 5)) throw new Error('Quote series unexpectedly small');
    const next = JSON.stringify(data) + '\n';
    const prior = await readFile(path, 'utf8').catch(() => '');
    if (next !== prior) await writeFile(path, next, 'utf8');
    console.log(`OK ${file}: ${hasSeries ? data.points.length + ' values' : 'fresh quote'}`);
    return true;
  } catch (error) {
    console.warn(`KEEP PREVIOUS ${file}: ${error.message}`);
    return false;
  }
}

const SYNC_STATUS_PATH = new URL('../public/data/sync-status.json', import.meta.url);
const MIN_SCHEDULE_GAP_MS = 50 * 60 * 1000;

export function isRecentFullSync(lastFullSyncAt, now = Date.now()) {
  const previous = Date.parse(lastFullSyncAt);
  return Number.isFinite(previous) && now >= previous && now - previous < MIN_SCHEDULE_GAP_MS;
}

export function buildSyncStatus(previous, names, outcomes, now) {
  const sources = Object.fromEntries(names.map((name, index) => [
    name, outcomes[index] ? now : (previous?.sources?.[name] || null)
  ]));
  const successful = outcomes.filter(Boolean).length;
  return {
    ok: true,
    lastRunAt: now,
    lastFullSyncAt: successful === names.length ? now : (previous?.lastFullSyncAt || null),
    successful,
    total: names.length,
    sources
  };
}

async function readSyncStatus() {
  try { return JSON.parse(await readFile(SYNC_STATUS_PATH, 'utf8')); }
  catch { return {}; }
}

async function main() {
  await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
  const previousStatus = await readSyncStatus();
  if (process.env.UPDATE_SCHEDULED === 'true' && process.argv.includes('--if-due') &&
      isRecentFullSync(previousStatus.lastFullSyncAt)) {
    console.log('Data sync: recent full update found; backup check skipped');
    return;
  }
  const jobs = [
    ['xau-latest', async () => parseXauPrice(JSON.parse(await fetchText('https://api.gold-api.com/price/XAU', { headers: { accept: 'application/json' } }))), false],
    ['xau-history', async () => {
      try { return parseXausHistory(await fetchXaus('history')); }
      catch { return parseXauHistory(await fetchEastmoneyXau(101, 500)); }
    }],
    ['xau-intraday', async () => {
      try { return parseXausIntraday(await fetchXaus('intraday?symbol=xau&hours=24')); }
      catch { return parseXauHistory(await fetchEastmoneyXau(5, 500), true); }
    }],
    ['sge-history', async () => parseDaily(await fetchSge('/graph/Dailyhq', 'POST'))],
    ['sge-intraday', async () => {
      let data;
      try { data = await fetchSge('/graph/quotations?instid=Au99.99'); }
      catch { data = await fetchSge('/graph/quotations', 'POST'); }
      return parseIntraday(data);
    }],
    ...Object.entries(BRANDS).map(([name, brand]) => [
      'brand-' + name,
      async () => parseBrand(await fetchText(brand.url, { headers: { accept: 'text/html' } }), name)
    ])
  ];
  const outcomes = await Promise.all(jobs.map(([file, producer, hasSeries]) => update(file, producer, hasSeries)));
  const status = buildSyncStatus(previousStatus, jobs.map(([file]) => file), outcomes, new Date().toISOString());
  await writeFile(SYNC_STATUS_PATH, JSON.stringify(status, null, 2) + '\n', 'utf8');
  console.log(`Data sync: ${outcomes.filter(Boolean).length}/${outcomes.length} sources updated`);
  // Existing snapshots are intentionally retained on temporary upstream errors.
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  await main();
}
