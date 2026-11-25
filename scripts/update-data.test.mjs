import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDaily, parseIntraday, parseBrand, parseXauPrice, parseXausSpot, parseXauHistory, parseXausHistory, parseXausIntraday, isRecentFullSync, buildSyncStatus } from './update-data.mjs';

test('hourly sync keeps a backup window and retries old or partial syncs', () => {
  const now = Date.parse('2026-11-19T11:47:00Z');
  assert.equal(isRecentFullSync('2026-11-19T11:17:00Z', now), true);
  assert.equal(isRecentFullSync('2026-11-19T10:47:00Z', now), false);
  assert.equal(isRecentFullSync(null, now), false);
  assert.equal(isRecentFullSync('2026-11-19T12:17:00Z', now), false);
});

test('sync status keeps previous successful source timestamps on failure', () => {
  const previous = { lastFullSyncAt: '2026-11-19T09:17:00Z', sources: { intl: '2026-11-19T09:17:00Z' } };
  const status = buildSyncStatus(previous, ['intl', 'china'], [false, true], '2026-11-19T10:17:00Z');
  assert.equal(status.lastFullSyncAt, previous.lastFullSyncAt);
  assert.equal(status.sources.intl, previous.sources.intl);
  assert.equal(status.sources.china, '2026-11-19T10:17:00Z');
  assert.equal(status.successful, 1);
});

test('SGE daily OHLC parsing and date sort', () => {
  const time = Array.from({ length: 5 }, (_, i) => [`2026-11-${String(5 - i).padStart(2, '0')}`, 810, 812 + i, 800, 821]);
  const data = parseDaily({ time });
  assert.equal(data.points.length, 5);
  assert.equal(data.points[0].date, '2026-11-01');
});

test('SGE intraday data', () => {
  const data = parseIntraday({ delaystr: '2026年11月20日 09:04:59', times: ['9:00', '9:01', '9:02', '9:03', '9:04'], data: [810, 811, 812, 813, 814] });
  assert.equal(data.points.at(-1).close, 814);
});

test('SGE intraday excludes future placeholders after the night quote', () => {
  const night = Array.from({ length: 391 }, (_, i) => {
    const minutes = (20 * 60 + i) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
  const day = Array.from({ length: 391 }, (_, i) => {
    const minutes = 9 * 60 + i;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
  const times = [...night, ...day];
  const prices = times.map((_, i) => i <= 135 ? 801.3 : 795.5);
  const input = { delaystr: '2026年11月20日 22:15:55', times, data: prices };
  const evening = parseIntraday(input);
  assert.equal(evening.points.length, 136);
  assert.deepEqual(evening.points.at(-1), { time: '22:15', close: 801.3 });

  const midnight = parseIntraday({ ...input, delaystr: '2026年11月20日 01:07:00' });
  assert.equal(midnight.points.length, 308);
  assert.equal(midnight.points.at(-1).time, '01:07');

  const morning = parseIntraday({ ...input, delaystr: '2026年11月20日 10:02:00' });
  assert.equal(morning.points.length, 454);
  assert.equal(morning.points.at(-1).time, '10:02');

  const closed = parseIntraday({ ...input, delaystr: '2026年11月20日 15:45:00' });
  assert.equal(closed.points.length, 782);
  assert.equal(closed.points.at(-1).time, '15:30');
  assert.throws(() => parseIntraday({ ...input, delaystr: '' }), /quote time unavailable/);
});

test('Brand price parser chooses ornament rather than platinum quote', () => {
  const html = '<section><div>周大福</div><b>1151元/克</b><i>545元/克</i><time>2026-11-18</time></section>' +
    '<div>周大福 1158元/克 561元/克 2026-11-17</div>' +
    '<div>周大福 1169元/克 566元/克 2026-11-16</div>' +
    '<div>周大福 1175元/克 583元/克 2026-11-13</div>' +
    '<div>周大福 1199元/克 592元/克 2026-11-12</div>';
  const data = parseBrand(html, 'chowtaifook');
  assert.equal(data.points.length, 5);
  assert.deepEqual(data.points.at(-1), { date: '2026-11-18', close: 1151 });
});

test('XAU price parser accepts a current USD per ounce quote', () => {
  const updatedAt = new Date(Date.now() - 60_000).toISOString();
  const quote = parseXauPrice({ symbol: 'XAU', currency: 'USD', price: 3742.15, updatedAt });
  assert.deepEqual(quote, { ok: true, source: 'Gold API', symbol: 'XAU',
    currency: 'USD', price: 3742.15, updatedAt });
});

test('XAU price parser rejects mismatched or stale data', () => {
  const updatedAt = new Date().toISOString();
  assert.throws(() => parseXauPrice({ symbol: 'XAG', currency: 'USD', price: 3742.15, updatedAt }));
  assert.throws(() => parseXauPrice({ symbol: 'XAU', currency: 'USD', price: -1, updatedAt }));
  assert.throws(() => parseXauPrice({ symbol: 'XAU', currency: 'USD', price: 3742.15, updatedAt: '2020-01-01T00:00:00Z' }));
});

test('Eastmoney XAU daily bars retain OHLC values and dates', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    `2026-11-${String(i + 1).padStart(2, '0')},3740,3743,3750,3730,123`);
  const parsed = parseXauHistory({ rc: 0, data: { code: 'XAU', klines: rows } });
  assert.equal(parsed.points.length, 8);
  assert.equal(parsed.points[0].close, 3743);
  assert.equal(parsed.interval, '1d');
});

test('Eastmoney XAU intraday bars show only most recent session', () => {
  const rows = ['2026-11-18 23:55,3738,3739,3741,3737,1',
    ...Array.from({ length: 8 }, (_, i) =>
      `2026-11-19 09:${String(i * 5).padStart(2, '0')},3740,3743,3750,3730,0`)];
  const parsed = parseXauHistory({ rc: 0, data: { code: 'XAU', klines: rows } }, true);
  assert.equal(parsed.points.length, 8);
  assert.equal(parsed.points[0].time, '09:00');
  assert.equal(parsed.quoteTime, '2026-11-19 09:35');
});

test('Eastmoney parser rejects other products and malformed candles', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    `2026-11-${String(i + 1).padStart(2, '0')},3740,3800,3750,3730`);
  assert.throws(() => parseXauHistory({ rc: 0, data: { code: 'GC', klines: rows } }));
  assert.throws(() => parseXauHistory({ rc: 0, data: { code: 'XAU', klines: rows } }));
});

test('XAUS daily history supports verified HLC without inventing open', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    ({ d: `2026-11-${String(i + 1).padStart(2, '0')}`, c: 3743, h: 3750, l: 3730 }));
  const parsed = parseXausHistory({ symbol: 'XAUUSD', points: rows });
  assert.equal(parsed.points.length, 8);
  assert.equal(parsed.points[0].open, undefined);
  assert.equal(parsed.points[0].close, 3743);
});

test('XAUS intraday conversion uses Shanghai time and latest calendar day', () => {
  const samples = Array.from({ length: 8 }, (_, i) => ({
    t: new Date(Date.UTC(2026, 10, 19, 1, i * 5)).toISOString(), p: 3740 + i
  }));
  const parsed = parseXausIntraday({ points: samples });
  assert.equal(parsed.points.length, 8);
  assert.equal(parsed.points[0].date, '2026-11-19');
  assert.equal(parsed.points[0].time, '09:00');
});

test('XAUS spot fallback uses a fresh USD/troy-ounce price and the source timestamp', () => {
  const as_of = '2026-11-25T01:00:00.000Z';
  const now = Date.parse('2026-11-25T01:02:00.000Z');
  const payload = { xau: { price: 4021.25, currency: 'USD', unit: 'troy_oz' },
    updated_at: '2026-11-25T01:01:00.000Z', data_state: { status: 'fresh', as_of } };
  const quote = parseXausSpot(payload, now);
  assert.equal(quote.price, 4021.25);
  assert.equal(quote.updatedAt, as_of);
  assert.match(quote.source, /^XAUS/);
  assert.throws(() => parseXausSpot({ ...payload, stale: true }, now));
  assert.throws(() => parseXausSpot({ ...payload, data_state: { status: 'stale', as_of } }, now));
  assert.throws(() => parseXausSpot({ ...payload, xau: { ...payload.xau, unit: 'gram' } }, now));
  assert.throws(() => parseXausSpot(payload, now + 15 * 60000));
  assert.throws(() => parseXausSpot({ ...payload, data_state: { status: 'fresh' } }, now));
});
