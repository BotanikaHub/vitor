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

const AGORA = Date.UTC(2026,7,27,12,0,0);       // 27/08/2026, quinta
const dia = n => String(AGORA + n*86400000);

/* páginas de resposta do clickup_filter_tasks, no formato real */
const PAGINAS = [
  {tasks:[
    {id:'a1',name:'DIA D KIDS — E-mail Marketing | Base geral',status:'backlog',
     url:'https://app.clickup.com/t/a1',assignees:[{username:'Pedro Lage'}],due_date:dia(4)},
    {id:'a2',name:'Criar copy do e-mail — QUA 26/08 até 18h | Dia D Kids',status:'feito',
     url:'https://app.clickup.com/t/a2',assignees:[{username:'Pedro Lage'}],due_date:dia(-1)},
    {id:'a3',name:'Programar o e-mail — SEX 28/08 até 18h | Dia D Kids',status:'sprint',
     url:'https://app.clickup.com/t/a3',assignees:[{username:'Sarah | Gestora'}],due_date:dia(1)},
    {id:'a4',name:'Subir criativos — SEG 25/08 até 18h | Dia D Kids',status:'backlog',
     url:'https://app.clickup.com/t/a4',assignees:[],due_date:dia(-2)},
  ],has_more:true,next_page:1},
  {tasks:[
    {id:'b1',name:'CREATINA NO CÉREBRO — Instagram Stories',status:'feito',
     url:'https://app.clickup.com/t/b1',assignees:[],due_date:dia(-3)},
    {id:'b2',name:'Publicar 3 stories — QUI 27/08 | Creatina',status:'feito',
     url:'https://app.clickup.com/t/b2',assignees:[],due_date:dia(0)},
    {id:'c1',name:'Implementar pop-up no site | BOTANIKA',status:'backlog',
     url:'https://app.clickup.com/t/c1',assignees:[],due_date:dia(2)},
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
  ok('semana separa por dia', /quinta|sexta|quarta/i.test(s), s.split('\n')[0]);
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

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
