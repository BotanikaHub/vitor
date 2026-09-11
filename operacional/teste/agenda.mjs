/* A agenda de cada pessoa.

   O que precisa valer: sem calendário ligado, a tela ensina a ligar em
   vez de ficar vazia; ligar manda o endereço para o servidor e nunca
   mais o traz de volta; os compromissos aparecem por dia, com hora de
   São Paulo; dentro de cada reunião dá para anotar, e a anotação fica
   para a equipe; o dia também mostra a tarefa que vence e a rotina; e
   quando a leitura do calendário falha, o que já se tinha continua na
   tela em vez de virar tela branca. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const porta = srv.address().port;

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10) };
/* 10h de São Paulo no dia pedido, em UTC */
const as10 = (d) => `${d}T13:00:00.000Z`;

const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Subir criativos do Dia D', status:'a fazer', assignees:['Pedro Lage'], due:hoje, brand:'Botanika', project:'Dia D' },
  { ...base, id:'t2', title:'Coisa da Sarah', status:'a fazer', assignees:['Sarah Brito'], due:hoje, brand:'Botanika', project:'Dia D' },
];
const AREAS = [{ id:'a-traf', nome:'Tráfego', slug:'trafego', ordem:1 }];
const PERFIS = [{ id:'u1', nome:'Pedro Lage', email:'p@b.com', papel:'gestor', ativo:true, cargo:'Tráfego', area_id:'a-traf', criado_em:null }];

const EVENTOS = [
  { uid:'kpi@1', titulo:'Reunião de KPI', onde:'Meet', sobre:'Levar os números', link:'', diaInteiro:false,
    comeca:as10(hoje), termina:`${hoje}T14:00:00.000Z`, gente:5 },
  { uid:'daily@1', titulo:'Daily da operação', onde:'', sobre:'', link:'', diaInteiro:false,
    comeca:`${hoje}T12:00:00.000Z`, termina:`${hoje}T12:15:00.000Z`, gente:8 },
  { uid:'amanha@1', titulo:'Alinhamento com a Ana', onde:'', sobre:'', link:'', diaInteiro:false,
    comeca:as10(dia(1)), termina:`${dia(1)}T14:00:00.000Z`, gente:2 },
  { uid:'longe@1', titulo:'Coisa de daqui a vinte dias', onde:'', sobre:'', link:'', diaInteiro:false,
    comeca:as10(dia(20)), termina:`${dia(20)}T14:00:00.000Z`, gente:2 },
];

const pedidos = [];
async function abrir(estado) {
  const pag = await nav.newPage({ viewport:{ width:1440, height:1100 } });
  pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
  await pag.addInitScript(([ts, areas, perfis]) => {
    window.supabase = { createClient: () => ({
      auth:{ getSession: async () => ({ data:{ session:{ access_token:'jwt-de-teste', user:{ id:'u1', email:'p@b.com' } } } }), signOut: async () => ({}) },
      rpc: async () => ({ data:null, error:null }),
      from: (nome) => {
        const dados = { areas, brands:[{ id:'m-bot', nome:'Botanika', slug:'botanika', ativo:true }], profiles:perfis,
                        equipe_convites:[], profile_brands:[{ profile_id:'u1', brand_id:'m-bot' }] }[nome] || [];
        const resp = { data: dados, error:null };
        const eq = { maybeSingle: async () => ({ data: perfis[0] }), is: () => ({ maybeSingle: async () => ({ data: perfis[0] }) }),
                     eq: () => eq, then:(f)=>Promise.resolve(resp).then(f) };
        return { select: () => ({ or: async () => ({ data:[{ chave:'central.tasks.vitor-gutierrez', dono:null, valor: ts }], error:null }),
                                  eq: () => eq, order: async () => resp, then:(f)=>Promise.resolve(resp).then(f) }),
                 upsert: async () => ({ error:null }) };
      },
    }) };
  }, [tarefas, AREAS, PERFIS]);
  await pag.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json',
    body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{}, em:new Date().toISOString() }) }));
  await pag.route('**/api/agenda**', (r) => {
    const req = r.request();
    pedidos.push({ metodo: req.method(), url: req.url(), corpo: req.postData(), auth: req.headers().authorization });
    if (req.method() === 'POST') {
      const c = JSON.parse(req.postData() || '{}');
      if (c.acao === 'desligar') { estado.ligado = false; return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ ligado:false, eventos:[] }) }) }
      if (!/^https:\/\/calendar\.google\.com\//.test(c.url || '')) {
        return r.fulfill({ status:400, contentType:'application/json', body: JSON.stringify({ erro:'Esse endereço não serve.' }) });
      }
      estado.ligado = true;
      return r.fulfill({ status:200, contentType:'application/json',
        body: JSON.stringify({ ligado:true, casa:'calendar.google.com', eventos:EVENTOS, lido_em:new Date().toISOString() }) });
    }
    return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(
      estado.ligado
        ? { ligado:true, casa:'calendar.google.com', eventos:EVENTOS, lido_em:new Date().toISOString(), erro: estado.erro || null }
        : { ligado:false, eventos:[] }) });
  });
  await pag.goto(`http://127.0.0.1:${porta}/#painel`, { waitUntil:'networkidle' });
  await pag.waitForTimeout(1400);
  await pag.locator('#painelView [data-tela="agenda"]').click();
  await pag.waitForTimeout(700);
  return pag;
}

/* ---------- 1. sem calendário ligado ---------- */
console.log('\nsem calendário ligado');
const estado = { ligado: false };
let p = await abrir(estado);
conf('a Agenda tem aba própria no painel', await p.locator('#painelView [data-tela="agenda"]').count() === 1);
const ensina = await p.locator('#painelCorpo .ag-ligar').innerText();
conf('a tela ensina a ligar em vez de ficar vazia', ensina.includes('Endereço secreto'));
conf('diz que só o dono vê o dele', /só você vê o seu/i.test(ensina));
conf('e avisa que o endereço é uma chave', /chave|vazar/i.test(ensina));
conf('cita o Notion Calendar e o Outlook', /Notion/.test(ensina) && /Outlook/.test(ensina));

/* endereço ruim */
await p.locator('[data-ag-url]').fill('https://sei-la.com/x.ics');
await p.locator('.ag-ligar button').click();
await p.waitForTimeout(500);
conf('endereço que não é de calendário é recusado com explicação',
     (await p.locator('.ag-msg').innerText()).includes('não serve'));
conf('e dá para tentar de novo', !(await p.locator('.ag-ligar button').isDisabled()));

/* ---------- 2. ligar ---------- */
console.log('\nligar o calendário');
await p.locator('[data-ag-url]').fill('https://calendar.google.com/calendar/ical/p%40b.com/private-abc/basic.ics');
await p.locator('.ag-ligar button').click();
await p.locator('#painelCorpo .ag-dia').first().waitFor({ state:'visible', timeout:5000 });
const enviado = pedidos.filter((x) => x.metodo === 'POST').pop();
conf('o endereço vai para o servidor', JSON.parse(enviado.corpo).url.includes('private-abc'));
conf('com a sessão de quem está ligando', enviado.auth === 'Bearer jwt-de-teste');
conf('e não sobra guardado no navegador', await p.evaluate(() =>
  !Object.keys(localStorage).some((k) => String(localStorage.getItem(k)).includes('private-abc'))));

/* ---------- 3. os compromissos ---------- */
console.log('\nos compromissos');
conf('os dias aparecem separados', await p.locator('#painelCorpo .ag-dia').count() >= 2);
const primeiro = await p.locator('#painelCorpo .ag-dia').first().innerText();
conf('o primeiro dia é hoje, e diz "hoje"', /hoje/i.test(primeiro));
conf('a daily vem antes da reunião de KPI, por hora',
     primeiro.indexOf('Daily') < primeiro.indexOf('Reunião de KPI'));
conf('a hora é a de São Paulo, e não a de Greenwich',
     (await p.locator('#painelCorpo .ag-dia').first().locator('.ag-hora').first().innerText()).startsWith('09:'));
conf('o segundo dia diz "amanhã"', /amanhã/i.test(await p.locator('#painelCorpo .ag-dia').nth(1).innerText()));
conf('quantas pessoas estão na reunião aparece', (await p.locator('.ag-gente').first().innerText()).includes('pessoas'));

/* a faixa */
conf('o que está a vinte dias não cabe nos sete', !(await p.locator('#painelCorpo').innerText()).includes('vinte dias'));
await p.locator('[data-ag-faixa="mes"]').click();
await p.waitForTimeout(500);
conf('e cabe nos trinta', (await p.locator('#painelCorpo').innerText()).includes('vinte dias'));
await p.locator('[data-ag-faixa="hoje"]').click();
await p.waitForTimeout(500);
conf('em "hoje", só hoje', await p.locator('#painelCorpo .ag-dia').count() === 1);
await p.locator('[data-ag-faixa="semana"]').click();
await p.waitForTimeout(500);

/* ---------- 4. a tarefa e a rotina do dia ---------- */
console.log('\no resto do dia');
const hojeTxt = await p.locator('#painelCorpo .ag-dia').first().innerText();
conf('a tarefa que vence hoje aparece no dia', hojeTxt.includes('Subir criativos'));
conf('mas só a minha, não a da Sarah', !hojeTxt.includes('Coisa da Sarah'));
conf('e a rotina de hoje também', await p.locator('#painelCorpo .ag-dia').first().locator('[data-ag-rotina]').count() > 0);
await p.locator('#painelCorpo [data-ag-rotina]').first().check();
await p.waitForTimeout(400);
conf('marcar a rotina daqui grava', await p.evaluate(() => Object.keys(window.Rotina.feitos()).length) > 0);
conf('e risca na hora', await p.locator('#painelCorpo .ag-rotina.ok').count() === 1);

/* ---------- 5. anotar a reunião ---------- */
console.log('\nanotar a reunião');
conf('a ficha da reunião começa fechada', await p.locator('#painelCorpo .ag-nota').count() === 0);
await p.locator('[data-ag-ev="kpi@1"]').click();
await p.waitForTimeout(500);
conf('abrir a reunião abre o espaço de anotação', await p.locator('[data-ag-nota="kpi@1"]').count() === 1);
conf('e diz quem vai ler, antes de a pessoa escrever',
     (await p.locator('#painelCorpo .ag-rot').first().innerText()).toLowerCase().includes('equipe'));
conf('a descrição do convite vem junto', (await p.locator('.ag-sobre').innerText()).includes('números'));

await p.locator('[data-ag-nota="kpi@1"]').fill('Pedro fecha o ROAS até sexta. Sarah leva o custo da API.');
await p.locator('#painelCorpo h4').first().click();
await p.waitForTimeout(400);
conf('a anotação fica gravada', await p.evaluate(() =>
  (window.Agenda.notas()['kpi@1'] || {}).texto.includes('Pedro fecha o ROAS')));
conf('com quem escreveu', await p.evaluate(() => (window.Agenda.notas()['kpi@1'] || {}).por) === 'Pedro Lage');
conf('e numa chave que a ponte leva para a equipe inteira', await p.evaluate(() =>
  window.Agenda.CHAVE_NOTAS.startsWith('central.')));

await p.locator('[data-ag-ev="kpi@1"] .ag-ev-topo').click();
await p.waitForTimeout(400);
conf('a reunião anotada fica marcada na lista, sem precisar abrir',
     await p.locator('[data-ag-ev="kpi@1"] .ag-tem-nota').count() === 1);
await p.locator('[data-ag-ev="kpi@1"] .ag-ev-topo').click();
await p.waitForTimeout(400);
conf('e a anotação continua lá quando se abre de novo',
     (await p.locator('[data-ag-nota="kpi@1"]').inputValue()).includes('Sarah leva o custo'));

/* apagar a anotação */
await p.locator('[data-ag-nota="kpi@1"]').fill('');
await p.locator('#painelCorpo h4').first().click();
await p.waitForTimeout(400);
conf('apagar o texto apaga a anotação, e não guarda vazio',
     await p.evaluate(() => !window.Agenda.notas()['kpi@1']));

/* ---------- 6. quando o calendário não responde ---------- */
console.log('\nquando o calendário não responde');
estado.erro = 'o calendário respondeu 503';
await p.locator('[data-ag-atualiza]').click();
await p.waitForTimeout(700);
conf('a tela avisa que não releu', (await p.locator('.ag-erro').innerText()).includes('503'));
conf('mas continua mostrando a última leitura, em vez de ficar em branco',
     await p.locator('#painelCorpo .ag-ev').count() > 0);
estado.erro = null;

/* ---------- 7. desligar ---------- */
console.log('\ndesligar');
await p.locator('[data-ag-desliga]').click();
await p.waitForTimeout(700);
conf('desligar volta para a tela de ligar', await p.locator('#painelCorpo .ag-ligar').count() === 1);
conf('e o servidor foi avisado', JSON.parse(pedidos.filter((x) => x.metodo === 'POST').pop().corpo).acao === 'desligar');
await p.close();

await nav.close();
srv.close();
console.log(`\nagenda: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
