import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDaily, parseIntraday, parseBrand } from './update-data.mjs';

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
