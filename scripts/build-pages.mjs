import { mkdir, readFile, writeFile, access } from 'node:fs/promises';

const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
if (!html.includes('./data/sge-history.json')) throw new Error('Static data loader not found');

const publicDir = new URL('../public/', import.meta.url);
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/index.html', import.meta.url), html, 'utf8');
await writeFile(new URL('../public/.nojekyll', import.meta.url), '', 'utf8');
const files = ['xau-latest', 'xau-history', 'xau-intraday', 'sge-history', 'sge-intraday', 'brand-chowtaifook', 'brand-laofengxiang', 'brand-zhouliufu'];
for (const file of files) {
  const path = new URL('../public/data/' + file + '.json', import.meta.url);
  try { await access(path); }
  catch { await writeFile(path, JSON.stringify({ ok: false, message: '等待自动同步行情' }) + '\n'); }
}
console.log('Built GitHub Pages: ' + publicDir.pathname);
