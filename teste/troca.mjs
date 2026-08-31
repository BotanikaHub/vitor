/* Exportar e importar. Era por aqui que o trabalho de alguém saía de um
   navegador e entrava em outro — e a caixa antiga não dizia nada ao ser
   aberta, nem tinha botão de copiar, então parecia que o clique não
   tinha funcionado. Estes testes prendem o comportamento novo. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});
const ctx = await b.newContext({viewport:{width:1400,height:950}});
await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
const p = await ctx.newPage();
const erros=[]; p.on('pageerror',e=>erros.push(e.message));
let perguntou='';
p.on('dialog',async d=>{perguntou=d.message();await d.accept()});
await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
await p.route('**/*.supabase.co/**',
  r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await p.reload({waitUntil:'networkidle'});
await p.waitForTimeout(500);
const G=(f,a)=>p.evaluate(f,a);
const msg=()=>G(()=>document.querySelector('#msg').textContent);

/* um planejamento com conteúdo, para ter o que exportar */
await G(()=>{
  const m=mesAtual(); m.metas=[300000,351000,399000]; m.ticket=200; m.ref='trabalho do time';
  AS={noId:null,tipo:'diaD',tema:null,inicio:'2026-09-07',fim:'2026-09-07',meta:120000,
    fontes:{traf:{meta:40000,inv:10000},api:{meta:32000,inv:4000}},nome:'Dia D Kids',
    produtos:CATALOGO.map(x=>x.sku),modoDesc:'todos',descGeral:8,descPorSku:{},extras:[],
    canais:CANAIS.map(c=>c[0]),receita:null};
  AS.inv=invTotal(AS.fontes); criarCampanha();
});
await p.waitForTimeout(300);

// ---- 1. exportar diz o que fez ----
await p.click('.rodape button:has-text("Exportar JSON")'); await p.waitForTimeout(500);
ok('a caixa abre dizendo o que tem dentro e o tamanho',
   /JSON · \d+ KB/.test(await G(()=>document.querySelector('#troca-msg').textContent)),
   await G(()=>document.querySelector('#troca-msg').textContent));
ok('a caixa fica visível de verdade', await G(()=>{
   const c=document.querySelector('#troca').getBoundingClientRect();
   return c.height>0 && c.top<innerHeight && c.bottom>0}));
const bts=await G(()=>document.querySelector('#troca-bts').textContent.replace(/\s+/g,' ').trim());
ok('oferece Copiar e Baixar, em vez de só selecionar',
   /Copiar/.test(bts)&&/Baixar/.test(bts), bts);

// ---- 2. copiar copia mesmo ----
await p.click('#troca-bts button:has-text("Copiar")'); await p.waitForTimeout(150);
ok('copiar responde no rodapé', /Copiado|selecionado/i.test(await msg()), await msg());
const naArea=await G(()=>navigator.clipboard.readText().then(t=>t.length).catch(()=>0));
ok('e o JSON foi pra área de transferência', naArea>500, 'chars='+naArea);
const json=await G(()=>document.querySelector('#troca-txt').value);
ok('o JSON exportado é o planejamento inteiro', (()=>{
  try{const d=JSON.parse(json);return d.campanhas.length===1&&d.meses.length>=2}catch(e){return false}
})(), 'chars='+json.length);
await G(()=>fecharTroca());

// ---- 3. importar só quando mandam ----
await G(()=>{D={prox:{mes:1,camp:1,mapa:1},mesAtivo:0,temas:[],meses:[],mapas:[],campanhas:[]};
  garantirCiclo();tudo()});
await p.click('.rodape button:has-text("Importar JSON")'); await p.waitForTimeout(300);
ok('o modo de importar tem botão próprio',
   /Importar/.test(await G(()=>document.querySelector('#troca-bts').textContent)));
await G(()=>{document.querySelector('#troca-txt').value='{quebrado'});
await G(()=>document.querySelector('#troca-txt').blur());
await p.waitForTimeout(300);
ok('clicar fora da caixa não importa nada sozinho',
   !/Importado|não é um JSON/i.test(await msg()), await msg());
await p.click('#troca-bts button:has-text("Importar")'); await p.waitForTimeout(300);
ok('JSON quebrado é recusado com motivo', /não é um JSON válido/i.test(await msg()), await msg());
await G(()=>{document.querySelector('#troca-txt').value='{"a":1}'});
await p.click('#troca-bts button:has-text("Importar")'); await p.waitForTimeout(300);
ok('JSON de outra coisa é recusado com motivo', /não é um planejamento/i.test(await msg()), await msg());

// ---- 4. importar de volta ----
perguntou='';
await G(j=>{document.querySelector('#troca-txt').value=j},json);
await p.click('#troca-bts button:has-text("Importar")'); await p.waitForTimeout(700);
ok('avisa o que vai substituir antes de trocar', /substitui o planejamento/i.test(perguntou),
   perguntou.replace(/\n/g,' ').slice(0,70));
ok('trouxe a campanha de volta', await G(()=>D.campanhas.length)===1,
   'camps='+await G(()=>D.campanhas.length));
ok('e a meta do mês junto', await G(()=>mesAtual().metas[0])===300000);
ok('a tela foi redesenhada com o que entrou',
   /Dia D Kids/.test(await G(()=>document.querySelector('#lista-camp-mes').innerText)));
ok('e o rodapé diz quanto entrou', /Importado: 1 campanha/.test(await msg()), await msg());
ok('a caixa fechou sozinha depois de importar',
   !(await G(()=>document.querySelector('#troca').classList.contains('on'))));

// ---- 5. o que foi importado fica salvo ----
await p.waitForTimeout(400);
ok('e ficou gravado no navegador', await G(()=>{
  try{return JSON.parse(localStorage.getItem(CHAVE)).campanhas.length===1}catch(e){return false}}));

ok('sem erro de JS', erros.length===0, erros.join(' | '));
await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
