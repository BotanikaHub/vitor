import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('file:///home/user/vitor/copies/copies-grupo-vip.html', { waitUntil: 'networkidle' });
await p.pdf({ path: 'Copies-Grupo-VIP-VermeFree.pdf', format: 'A4', printBackground: true });
await b.close();
console.log('pdf pronto');
