import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDaily, parseIntraday, parseBrand, parseXauPrice, parseXauHistory } from './update-data.mjs';

test('SGE daily OHLC parsing and date sort', () => {
  const time = Array.from({ length: 5 }, (_, i) => [`2026-11-${String(5 - i).padStart(2, '0')}`, 810, 812 + i, 800, 821]);
  const data = parseDaily({ time });
  assert.equal(data.points.length, 5);
  assert.equal(data.points[0].date, '2026-11-01');
});

test('SGE intraday data', () => {
  const data = parseIntraday({ times: ['9:00', '9:01', '9:02', '9:03', '9:04'], data: [810, 811, 812, 813, 814] });
  assert.equal(data.points.at(-1).close, 814);
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
