/* Exercita a aba Gestão com o ClickUp simulado. Fora do claude.ai a
   capacidade não existe e a página explica isso — esse caminho também
   está coberto aqui. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});

/* Meio-dia de hoje: o que vence em dia(-1) está atrasado e o que vence em
   dia(1) não está, a qualquer hora que o teste rode. */
const AGORA = new Date().setHours(12,0,0,0);
const dia = n => String(AGORA + n*86400000);

const BOT={id:'901328142624'}, VF={id:'901328142677'};

/* páginas de resposta do clickup_filter_tasks, no formato real */
const PAGINAS = [
  {tasks:[
    {id:'a1',name:'DIA D KIDS — E-mail Marketing | Base geral',status:'backlog',list:BOT,
     url:'https://app.clickup.com/t/a1',assignees:[{username:'Pedro Lage'}],due_date:dia(4)},
    {id:'a2',name:'Criar copy do e-mail — QUA 26/08 até 18h | Dia D Kids',status:'feito',list:BOT,
     url:'https://app.clickup.com/t/a2',assignees:[{username:'Pedro Lage'}],due_date:dia(-1)},
    {id:'a3',name:'Programar o e-mail — SEX 28/08 até 18h | Dia D Kids',status:'sprint',list:BOT,
     url:'https://app.clickup.com/t/a3',assignees:[{username:'Sarah | Gestora'}],due_date:dia(1)},
    {id:'a4',name:'Subir criativos — SEG 25/08 até 18h | Dia D Kids',status:'backlog',list:BOT,
     url:'https://app.clickup.com/t/a4',assignees:[],due_date:dia(-2)},
  ],has_more:true,next_page:1},
  {tasks:[
    {id:'b1',name:'CREATINA NO CÉREBRO — Instagram Stories',status:'feito',list:BOT,
     url:'https://app.clickup.com/t/b1',assignees:[],due_date:dia(-3)},
    {id:'b2',name:'Publicar 3 stories — QUI 27/08 | Creatina',status:'feito',list:BOT,
     url:'https://app.clickup.com/t/b2',assignees:[],due_date:dia(0)},
    {id:'c1',name:'Implementar pop-up no site | BOTANIKA',status:'backlog',list:BOT,
     url:'https://app.clickup.com/t/c1',assignees:[],due_date:dia(2)},
    {id:'d1',name:'PROGRAMA DE UGC — Estruturar com a Bianca | BOTANIKA + VERMEFREE',
     status:'backlog',list:VF,url:'https://app.clickup.com/t/d1',
     assignees:[{username:'Vanessa Ferreira'}],due_date:dia(5)},
    {id:'v1',name:'FRASCO NOVO — Lançamento | VermeFree',status:'backlog',list:VF,
     url:'https://app.clickup.com/t/v1',assignees:[{username:'Sarah | Gestora'}],due_date:dia(3)},
  ],has_more:false},
];

async function abrir({temMcp=true,erro=null}={}){
  const p = await b.newPage({viewport:{width:1400,height:1000}});
  const erros=[]; p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/dados/estado.json*', r=>r.fulfill({status:404,body:''}));
  await p.addInitScript(({temMcp,erro,PAGINAS})=>{
    try{localStorage.clear()}catch(e){}
    window.__chamadas=[];
    const mcp={ callTool: async (servidor,ferramenta,entrada)=>{
      window.__chamadas.push({servidor,ferramenta,entrada});
      if(erro){const e=new Error('simulado');Object.assign(e,erro);throw e}
      return {payload: PAGINAS[entrada.page||0]};
    }};
    window.claude={ use: async n => n==='mcp' ? (temMcp?mcp:null) : null };
  },{temMcp,erro,PAGINAS});
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  await p.waitForTimeout(400);
  await p.click('nav.paginas button[data-pg="gestao"]');
  await p.waitForTimeout(600);
  return {p,erros};
}
const T=(p,f)=>p.evaluate(f);
const criarCampNoTAP=(p,nome)=>p.evaluate(n=>{
  D.campanhas.push({id:D.prox.camp++,mesId:D.mesAtivo,nome:n,tipo:'diaD',tema:'',
    oferta:{produtos:[],modoDesc:'geral',descGeral:0,descPorSku:{},extras:[],
      frete:'',brinde:'',bonusUniversal:'',bonusInfluencer:''},
    canais:[],receita:{},meta:50000,investimento:10000,
    inicio:'2026-09-10',fim:'2026-09-10',secoes:[]});
  pintarMes();
},nome);
const corpo=p=>T(p,()=>document.querySelector('#g-corpo').innerText);

// ---- 1. lê o ClickUp e agrupa por ação ----
{
  const {p,erros}=await abrir();
  const ch=await T(p,()=>window.__chamadas);
  ok('chamou o ClickUp', ch.length>=1, 'chamadas='+ch.length);
  ok('nomeou o conector e a ferramenta',
     ch[0]?.servidor==='ClickUp'&&ch[0]?.ferramenta==='clickup_filter_tasks',
     `${ch[0]?.servidor}/${ch[0]?.ferramenta}`);
  ok('pediu as duas listas com fechadas e subtarefas',
     ch[0]?.entrada?.list_ids?.length===2&&ch[0]?.entrada?.include_closed===true
     &&ch[0]?.entrada?.subtasks===true);
  ok('seguiu a paginação até o fim', ch.length===2, 'páginas='+ch.length);

  const t=await corpo(p);
  ok('agrupou Dia D Kids', /Dia D Kids/.test(t), t.split('\n')[0]);
  ok('contou feitas sobre o total', /1 de 4 feitas/.test(t));
  ok('Creatina fechada aparece como pronta', /pronta para conferir/i.test(t));
  ok('marca no fim não virou ação', /Sem ação identificada/.test(t));
  ok('mostrou o que falta, não o que foi feito',
     /Programar o e-mail/.test(t) && !/Criar copy do e-mail/.test(t));
  ok('carimbou a hora da leitura',
     /lido \d{2}:\d{2}/.test(await T(p,()=>document.querySelector('#g-quando').textContent)));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 2. semana e atrasado ----
{
  const {p,erros}=await abrir();
  await p.click('#pg-gestao .g-abas button[data-ga="semana"]');
  await p.waitForTimeout(200);
  const s=await corpo(p);
  ok('semana separa por dia',
     /(segunda|terça|quarta|quinta|sexta|sábado|domingo) \d{2}\/\d{2} · \d+ de \d+ feitas/i.test(s),
     s.split('\n')[0]);
  ok('semana diz a ação de cada tarefa', /Dia D Kids/.test(s));

  await p.click('#pg-gestao .g-abas button[data-ga="atrasado"]');
  await p.waitForTimeout(200);
  const a=await corpo(p);
  ok('atrasado pega prazo vencido e não feito', /Subir criativos/.test(a));
  ok('atrasado não pega o que já foi feito', !/Publicar 3 stories/.test(a));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 3. cada erro tem a sua saída ----
for(const [codigo,esperado] of [
  ['needs_reauth',/Reconecte/i],
  ['server_not_connected',/não está conectado nesta conta/i],
  ['selection_required',/mais de um ClickUp/i],
  ['blocked_by_policy',/política da organização/i],
]){
  const {p,erros}=await abrir({erro:{code:codigo}});
  const t=await corpo(p);
  ok(`erro ${codigo} explica a saída certa`, esperado.test(t), t.replace(/\n/g,' ').slice(0,70));
  ok(`erro ${codigo} sem quebrar a página`, erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 4. fora do claude.ai ----
{
  const {p,erros}=await abrir({temMcp:false});
  const t=await corpo(p);
  ok('sem a capacidade, explica em vez de ficar vazia', /só responde com a página aberta no claude\.ai/i.test(t),
     t.replace(/\n/g,' ').slice(0,70));
  ok('não tentou chamar nada', (await T(p,()=>window.__chamadas)).length===0);
  ok('o resto do planejador continua de pé',
     await T(p,()=>!!document.querySelector('#tit-mes').textContent));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 5. a Gestão segue o seletor de mês e de marca ----
{
  const {p,erros}=await abrir();
  const t=await corpo(p);
  ok('mês aberto é da Botanika: só as tarefas dela aparecem',
     /Dia D Kids/.test(t) && !/Frasco Novo|Lançamento/i.test(t));
  ok('tarefa das duas marcas não some da Botanika, mesmo na lista da VermeFree',
     /PROGRAMA DE UGC/i.test(t));
  ok('o botão diz qual marca está filtrando',
     /^Só Botanika$/.test(await T(p,()=>document.querySelector('#g-marca').textContent)));

  await p.click('#g-marca');
  await p.waitForTimeout(200);
  const dois=await corpo(p);
  ok('abrindo as duas marcas, a VermeFree entra', /Lançamento/i.test(dois));
  ok('o botão troca de rótulo',
     /duas marcas/i.test(await T(p,()=>document.querySelector('#g-marca').textContent)));

  await p.click('#g-marca');
  await p.waitForTimeout(200);
  ok('volta a filtrar', !/Lançamento/i.test(await corpo(p)));

  /* trocar para o mês da VermeFree troca o recorte sem nova leitura */
  const antes=(await T(p,()=>window.__chamadas)).length;
  await p.evaluate(()=>{
    const vf=D.meses.find(m=>(m.marca||'')==='VermeFree');
    document.querySelector('#sel-mes').value=vf.id;
    trocarMes(vf.id);
  });
  await p.waitForTimeout(300);
  const vf=await corpo(p);
  ok('mês da VermeFree mostra a ação da VermeFree', /Lançamento/i.test(vf));
  ok('e esconde a da Botanika', !/Dia D Kids/.test(vf));
  ok('sem reler o ClickUp pra trocar de marca',
     (await T(p,()=>window.__chamadas)).length===antes);
  ok('tarefa das duas marcas aparece na VermeFree', /Programa De Ugc|PROGRAMA DE UGC/i.test(vf));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 5b. marca sem tarefa nenhuma explica o vazio ----
{
  const {p,erros}=await abrir();
  await p.evaluate(()=>{
    const base=D.meses[0];
    const nova={id:D.prox.mes++,ano:base.ano,mes:base.mes,marca:'Marca Sem Nada',
      metas:[0,0,0],ref:''};
    D.meses.push(nova);
    D.mapas.push({id:D.prox.mapa++,mesId:nova.id,nome:'x',layout:'direita',
      prox:2,proxItem:1,itens:[],nos:[{id:1,pai:null,t:'x',cor:0,raizMes:nova.id,x:0,y:0}]});
    trocarMes(nova.id);
  });
  await p.waitForTimeout(300);
  const t=await corpo(p);
  ok('marca sem tarefa não fica em branco', /Nenhuma tarefa da Marca Sem Nada/i.test(t),
     t.replace(/\n/g,' ').slice(0,90));
  ok('e diz quantas tarefas existem do outro lado', /9 tarefas de Gestão Operacional/i.test(t));

  await p.click('#g-corpo .g-tap');
  await p.waitForTimeout(300);
  ok('o botão do aviso abre as duas marcas', /Dia D Kids/.test(await corpo(p)));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 6. placar do topo ----
{
  const {p,erros}=await abrir();
  const r=await T(p,()=>document.querySelector('#g-resumo').innerText);
  ok('placar diz quanto já foi concluído', /Tarefas concluídas/i.test(r), r.replace(/\n/g,' ').slice(0,80));
  ok('placar conta as ações prontas para conferir', /Ações prontas para conferir/i.test(r));
  ok('placar mostra as atrasadas', /Atrasadas/i.test(r));
  ok('placar mostra o que vence nesta semana', /Esta semana/i.test(r));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 7. por pessoa ----
{
  const {p,erros}=await abrir();
  await p.click('#pg-gestao .g-abas button[data-ga="pessoa"]');
  await p.waitForTimeout(200);
  const t=await corpo(p);
  ok('agrupa por responsável', /Pedro Lage/.test(t) && /Sarah/.test(t), t.split('\n')[0]);
  ok('conta feitas por pessoa', /de \d+ feitas/.test(t));
  ok('tarefa sem dono não some', /Sem responsável/i.test(t));
  ok('lista só o que falta', /Programar o e-mail/.test(t) && !/Criar copy do e-mail/.test(t));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 8. ação do ClickUp ligada à campanha do TAP ----
{
  const {p,erros}=await abrir();
  await criarCampNoTAP(p,'Dia D Kids');
  await p.click('nav.paginas button[data-pg="gestao"]');
  await p.waitForTimeout(300);
  ok('a ação oferece abrir o TAP da campanha',
     await T(p,()=>[...document.querySelectorAll('#g-corpo .g-acao')]
       .some(a=>/Dia D Kids/.test(a.textContent)&&a.querySelector('.g-tap'))));
  ok('ação sem campanha no TAP não inventa botão',
     await T(p,()=>[...document.querySelectorAll('#g-corpo .g-acao')]
       .every(a=>/Dia D Kids/.test(a.textContent)||!a.querySelector('.g-tap'))));

  await p.click('#g-corpo .g-acao .g-tap');
  await p.waitForTimeout(300);
  ok('o botão leva mesmo para o TAP',
     await T(p,()=>document.querySelector('#pg-camp').classList.contains('on')));

  /* e o caminho de volta: a faixa do Mês mostra a execução */
  await p.click('nav.paginas button[data-pg="mes"]');
  await p.waitForTimeout(300);
  const mes=await T(p,()=>document.querySelector('#lista-camp-mes').innerText);
  ok('a campanha do Mês mostra quanto já foi executado', /1\/4 feitas/.test(mes),
     mes.replace(/\n/g,' ').slice(0,90));
  ok('e avisa das atrasadas', /· 1 atrasada/.test(mes));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 9. campanha sem nada no ClickUp aparece como tal ----
{
  const {p,erros}=await abrir();
  await criarCampNoTAP(p,'Campanha que ninguém abriu no ClickUp');
  await p.waitForTimeout(300);
  const mes=await T(p,()=>document.querySelector('#lista-camp-mes').innerText);
  ok('campanha sem tarefa no ClickUp fica marcada', /sem tarefas no ClickUp/i.test(mes),
     mes.replace(/\n/g,' ').slice(0,90));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
