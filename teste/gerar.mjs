/* Gerar tarefas do planejamento e pôr na fila de aprovação. O que se
   protege aqui: o nome tem que sair no padrão do ClickUp, nada pode ser
   aprovado sem alguém marcar, e o que já foi para a fila não pode ser
   proposto de novo. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1500,height:1000}});
const erros=[]; p.on('pageerror',e=>erros.push(e.message));
let perguntou=''; p.on('dialog',async d=>{perguntou=d.message();await d.accept()});

/* Supabase simulado: guarda o que a tela grava na fila */
const fila=[];
await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
await p.route('**/*.supabase.co/**', async r=>{
  const req=r.request(), u=req.url();
  if(/tarefas_planejadas/.test(u)){
    if(req.method()==='POST'){
      JSON.parse(req.postData()||'[]').forEach(x=>fila.push(x));
      return r.fulfill({status:201,contentType:'application/json',body:'[]'});
    }
    return r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(fila.map(t=>({assinatura:t.assinatura,situacao:t.situacao,clickup_url:null})))});
  }
  if(req.method()==='POST')return r.fulfill({status:201,contentType:'application/json',body:'[{"versao":1}]'});
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});
});
await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await p.reload({waitUntil:'networkidle'});
await p.waitForTimeout(700);
const G=(f,a)=>p.evaluate(f,a);

/* uma ação com cronograma de verdade, na semana que vem */
await G(()=>{
  const h=new Date();h.setHours(12,0,0,0);
  const seg=new Date(h);seg.setDate(h.getDate()-((h.getDay()+6)%7)+7);
  const m=mesAtual();m.ano=seg.getFullYear();m.mes=seg.getMonth()+1;m.metas=[300000,0,0];
  AS={noId:null,tipo:'semana',tema:'Imunidade',
    inicio:iso(seg),fim:iso(new Date(seg.getTime()+4*864e5)),meta:60000,
    fontes:{traf:{meta:16000,inv:4000},api:{meta:16000,inv:2000}},nome:'Semana Imunidade',
    produtos:catalogo().map(x=>x.sku),modoDesc:'todos',descGeral:10,descPorSku:{},
    extras:[],canais:CANAIS.map(c=>c[0]),receita:null};
  AS.inv=invTotal(AS.fontes);criarCampanha();
});
await p.waitForTimeout(500);
await p.click('nav.paginas button[data-pg="gestao"]'); await p.waitForTimeout(400);
await p.click('#pg-gestao .g-abas button[data-ga="gerar"]'); await p.waitForTimeout(700);
const corpo=()=>G(()=>document.querySelector('#g-corpo').innerText);

// ---- 1. propõe a partir do cronograma ----
{
  const t=await corpo();
  ok('a aba propõe as peças do período', /peças no período/.test(t), t.split('\n')[0]);
  const linhas=await G(()=>document.querySelectorAll('#g-corpo .ta-linha').length);
  ok('e lista uma linha por peça', linhas>0, 'linhas='+linhas);
  ok('agrupa por ação, com tarefa-mãe',
     /SEMANA IMUNIDADE — \d{2}\/\d{2} \|/.test(t) && /tarefa-mãe/.test(t), 
     t.split('\n').find(l=>/SEMANA IMUNIDADE/.test(l)));
  ok('o nome sai no padrão do ClickUp',
     /SEMANA IMUNIDADE — .+ · (SEG|TER|QUA|QUI|SEX|SÁB|DOM) \d{2}\/\d{2} \| BOTANIKA/.test(t),
     t.split('\n').find(l=>/· (SEG|TER|QUA|QUI|SEX)/.test(l)));
  ok('cada peça mostra quem faz', /Pedro|Sarah|Italo|Gestor/.test(t));
  ok('nada nasce marcado', await G(()=>taMarcadas.size)===0);
}

// ---- 2. aprovar exige marcar ----
{
  perguntou='';
  await p.click('#g-corpo .ta-topo button.forte'); await p.waitForTimeout(300);
  ok('aprovar sem marcar nada não faz nada',
     fila.length===0 && /Marque ao menos uma/.test(await G(()=>document.querySelector('#msg').textContent)),
     await G(()=>document.querySelector('#msg').textContent));
  ok('e nem chega a perguntar', perguntou==='');
}

// ---- 3. marcar e aprovar ----
{
  await p.click('#g-corpo .ta-topo button:has-text("marcar todas")'); await p.waitForTimeout(400);
  const n=await G(()=>taMarcadas.size);
  ok('marcar todas marca as peças', n>0, 'n='+n);
  perguntou='';
  await p.click('#g-corpo .ta-topo button.forte'); await p.waitForTimeout(700);
  ok('avisa quantas vão, e que não cria nada ainda',
     /Aprovar \d+ tarefa/.test(perguntou) && /fila/.test(perguntou),
     perguntou.slice(0,80));
  ok('a fila recebeu as peças', fila.length>=n, `fila=${fila.length} peças=${n}`);
  ok('e a tarefa-mãe junto', fila.some(t=>/§mae$/.test(t.assinatura)));
  ok('tudo entra como aprovada, nunca como criada',
     fila.every(t=>t.situacao==='aprovada'));
  ok('a filha aponta pra mãe',
     fila.filter(t=>t.dia).every(t=>/§mae$/.test(t.mae_de||'')));
  ok('registra quem aprovou e quando',
     fila.every(t=>/^aba-/.test(t.quem||'')&&t.decidida_em));
  ok('o rodapé confirma e diz o próximo passo',
     /na fila. Peça pra eu criar no ClickUp/.test(await G(()=>document.querySelector('#msg').textContent)),
     await G(()=>document.querySelector('#msg').textContent));
}

// ---- 4. o que já foi pra fila não volta a ser proposto ----
{
  await p.waitForTimeout(600);
  const t=await corpo();
  ok('quem já está na fila aparece marcado como tal', /aguardando/i.test(t));
  ok('e não dá mais pra marcar',
     await G(()=>[...document.querySelectorAll('#g-corpo .ta-linha input')].every(i=>i.disabled)));
  await p.click('#g-corpo .ta-topo button:has-text("marcar todas")'); await p.waitForTimeout(300);
  ok('marcar todas ignora o que já foi', await G(()=>taMarcadas.size)===0,
     'n='+await G(()=>taMarcadas.size));
}

ok('sem erro de JS', erros.length===0, erros.join(' | '));
await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
