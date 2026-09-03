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

// ---- 1. uma tarefa por tipo de trabalho, não por linha do cronograma ----
{
  const t=await corpo();
  ok('a aba conta ações e tarefas, não peças',
     /1 ação com data no período, \d+ tarefas/.test(t), t.split('\n').find(l=>/ação/.test(l))||t.split('\n')[0]);
  const nomes=await G(()=>[...document.querySelectorAll('#g-corpo .ta-linha .nm')]
    .map(e=>e.firstChild.textContent.trim()));
  ok('gera poucas tarefas, no tamanho do que a equipe usa',
     nomes.length>=6 && nomes.length<=12, nomes.length+' tarefas');
  ok('cada uma é um trabalho, com verbo',
     nomes.some(n=>/— Criar toda a copy ·/.test(n)) &&
     nomes.some(n=>/— Criar todas as artes ·/.test(n)) &&
     nomes.some(n=>/— Programar todos os disparos ·/.test(n)),
     nomes.slice(0,3).join(' / '));
  ok('nenhuma tarefa é uma linha de cronograma solta',
     !nomes.some(n=>/E-mails base antiga \(|WhatsApp grupos antigos \(/.test(n)),
     nomes.find(n=>/\(\d/.test(n))||'nenhuma');
  ok('tem o fecho da ação: conferir, acompanhar e reverter',
     nomes.some(n=>/Conferir que tudo entrou no ar/.test(n)) &&
     nomes.some(n=>/Acompanhar a campanha durante o dia/.test(n)) &&
     nomes.some(n=>/Reverter site, pausar campanha/.test(n)));
  ok('o nome traz dia e hora, no padrão do ClickUp',
     nomes.some(n=>/· (SEG|TER|QUA|QUI|SEX|SÁB|DOM) \d{2}\/\d{2} até \d{2}h \| BOTANIKA$/.test(n)),
     nomes.find(n=>/até/.test(n)));
  ok('a preparação toda vence numa quinta',
     await G(()=>taAcoes(taDe,taAte)[0].filhas.filter(f=>f.momento==='prep')
       .every(f=>new Date(f.dia+'T12:00:00').getDay()===4)));
  ok('e a reversão fica no dia seguinte ao fim',
     await G(()=>{const a=taAcoes(taDe,taAte)[0];
       const r=a.filhas.find(f=>f.momento==='depois');
       return r && new Date(r.dia+'T12:00:00')-a.fim===86400000}));
  ok('o cronograma virou checklist dentro da tarefa',
     /no checklist:/.test(t) && await G(()=>taAcoes(taDe,taAte)[0].filhas
       .some(f=>f.checklist.length>1)));
  ok('cada trabalho tem seu dono',
     await G(()=>{const f=taAcoes(taDe,taAte)[0].filhas;
       return f.find(x=>x.momento==='prep'&&/artes/.test(x.nome))?.responsavel==='Ítalo Neves'
         && f.find(x=>/disparos/.test(x.nome))?.responsavel.startsWith('Sarah')}));
  ok('nada nasce marcado', await G(()=>taMarcadas.size)===0);
}

// ---- 2. aprovar exige marcar ----
{
  perguntou='';
  await p.click('#g-corpo .ta-topo button.forte'); await p.waitForTimeout(300);
  ok('aprovar sem marcar nada não faz nada',
     fila.length===0 && /Marque ao menos uma/.test(await G(()=>document.querySelector('#msg').textContent)));
  ok('e nem chega a perguntar', perguntou==='');
}

// ---- 3. marcar e aprovar ----
{
  await p.click('#g-corpo .ta-topo button:has-text("marcar todas")'); await p.waitForTimeout(400);
  const n=await G(()=>taMarcadas.size);
  ok('marcar todas marca as tarefas', n>0, 'n='+n);
  perguntou='';
  await p.click('#g-corpo .ta-topo button.forte'); await p.waitForTimeout(700);
  ok('avisa quantas vão, e que não cria nada ainda',
     /Aprovar \d+ tarefa/.test(perguntou) && /fila/.test(perguntou), perguntou.slice(0,70));
  ok('a fila recebeu as tarefas e a mãe', fila.length===n+1, `fila=${fila.length} marcadas=${n}`);
  const mae=fila.find(t=>!t.mae_de);
  /* no ClickUp a mãe é "DIA D KIDS — 31/08 | VERMEFREE": só a data */
  ok('a mãe tem o nome da ação com a data, sem dia da semana',
     /^[A-ZÀ-Ÿ ]+ — \d{2}\/\d{2} \| BOTANIKA$/.test(mae.nome), mae.nome);
  ok('e uma descrição de verdade, com oferta e fases',
     /## A oferta/.test(mae.descricao) && /## O objetivo/.test(mae.descricao) &&
     /Cortada por pessoa e por momento/.test(mae.descricao),
     mae.descricao.split('\n')[0]);
  ok('a descrição diz quantas tarefas cada um levou',
     /\*\*Pedro\*\* \d+/.test(mae.descricao),
     mae.descricao.split('\n').at(-1));
  ok('tudo entra como aprovada, nunca como criada', fila.every(t=>t.situacao==='aprovada'));
  /* o quadro de Tarefas filtra por lista; tarefa aprovada sem lista
     nasceria invisível lá */
  ok('cada tarefa nasce numa lista do ClickUp',
     fila.every(t=>t.lista==='Botanika'), JSON.stringify(fila.map(t=>t.lista).slice(0,3)));
  ok('as filhas apontam pra mãe', fila.filter(t=>t.mae_de).every(t=>t.mae_de===mae.assinatura));
  ok('o checklist vai junto',
     fila.some(t=>Array.isArray(t.checklist)&&t.checklist.length>0));
  ok('cada tarefa leva prioridade', fila.every(t=>/^(urgent|high)$/.test(t.prioridade||'')));
  ok('registra quem aprovou e quando',
     fila.every(t=>/^aba-/.test(t.quem||'')&&t.decidida_em));
}

// ---- 4. o que já foi pra fila não volta a ser proposto ----
{
  await p.waitForTimeout(600);
  ok('quem já está na fila aparece marcado como tal', /aguardando/i.test(await corpo()));
  ok('e não dá mais pra marcar',
     await G(()=>[...document.querySelectorAll('#g-corpo .ta-linha input')].every(i=>i.disabled)));
  await p.click('#g-corpo .ta-topo button:has-text("marcar todas")'); await p.waitForTimeout(300);
  ok('marcar todas ignora o que já foi', await G(()=>taMarcadas.size)===0);
}

// ---- 5. o que roda o mês inteiro não vira tarefa ----
{
  await G(()=>{
    const m=mesAtual();
    AS={noId:null,tipo:'perpetuo',tema:null,inicio:iso(new Date(m.ano,m.mes-1,1)),
      fim:iso(new Date(m.ano,m.mes,0)),meta:30000,
      fontes:{traf:{meta:8000,inv:2000},api:{meta:8000,inv:1000}},nome:'Orgânico — E-mail',
      produtos:[],modoDesc:'todos',descGeral:0,descPorSku:{},extras:[],
      canais:CANAIS.map(c=>c[0]),receita:null};
    AS.inv=invTotal(AS.fontes);criarCampanha();
    document.querySelector('nav.paginas button[data-pg="gestao"]').click();
  });
  await p.waitForTimeout(500);
  await p.click('#pg-gestao .g-abas button[data-ga="gerar"]'); await p.waitForTimeout(500);
  ok('perpétuo fica de fora: não tem preparação nem dia D',
     !/ORGÂNICO — E-MAIL/.test(await corpo()),
     (await corpo()).split('\n').find(l=>/ORGÂNICO/.test(l))||'ficou de fora');
}

ok('sem erro de JS', erros.length===0, erros.join(' | '));
await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
