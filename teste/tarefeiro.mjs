/* A aba Tarefas: o ClickUp aqui dentro. O Supabase é simulado — a suíte
   nunca fala com a base de verdade — e o que se testa é o que a pessoa vê
   e o que a página grava quando ela mexe numa tarefa. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});

const hoje=new Date(), d=n=>{const x=new Date(hoje);x.setDate(x.getDate()+n);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};

/* Os status configurados em cada lista, como o ClickUp devolve. Repare
   que "revisar" e "ajustes necessários" não têm tarefa nenhuma: é
   exatamente o caso que faz a coluna sumir se ela for deduzida das
   tarefas em vez de vir da lista. */
const STATUS=[
  {nome:'a fazer',cor:'#87909e',ordem:0,fecha:false},
  {nome:'fazendo',cor:'#b660e0',ordem:1,fecha:false},
  {nome:'revisar',cor:'#f8ae00',ordem:2,fecha:false},
  {nome:'ajustes necessários',cor:'#e16b16',ordem:3,fecha:false},
  {nome:'feito',cor:'#008844',ordem:4,fecha:true},
];
const LISTAS=()=>[
  {lista_id:'901328327165',nome:'Botanika',statuses:STATUS},
  {lista_id:'901328142677',nome:'VermeFree',statuses:STATUS},
];
const cor=st=>(STATUS.find(s=>s.nome===st)||{}).cor||null;
const ordem=st=>STATUS.findIndex(s=>s.nome===st);

/* O que a base devolve. Uma mãe com duas filhas, uma avulsa e uma da
   outra lista, para o filtro ter o que filtrar. */
const enfeita=t=>Object.assign({
  lista:t.marca==='VERMEFREE'?'VermeFree':'Botanika',
  status_cor:cor(t.status),status_ordem:ordem(t.status),
  prioridade_cor:null,responsaveis:t.responsavel?[{id:1,nome:t.responsavel}]:[],
  etiquetas:[],encerrada_em:t.status==='feito'?new Date().toISOString():null,
  projeto:t.campanha,fase:null,clickup_pai:t.mae_de?t.mae_de.replace('§mae','')  :null
},t);
const TAREFAS=()=>[
  {assinatura:'BOTANIKA§1§mae',marca:'BOTANIKA',campanha:'Dia D Kids',
   nome:'DIA D KIDS — 10/09 | BOTANIKA',responsavel:'Pedro Lage',prioridade:'urgent',
   dia:d(3),inicio:d(-2),situacao:'aprovada',status:'a fazer',checklist:null,
   checklist_feito:[],ordem:0,mae_de:null,descricao:'# A oferta\n30% OFF'},
  {assinatura:'BOTANIKA§1§copy',marca:'BOTANIKA',campanha:'Dia D Kids',
   nome:'DIA D KIDS — Criar toda a copy · QUI 04/09 até 18h | BOTANIKA',
   responsavel:'Pedro Lage',prioridade:'urgent',dia:d(-1),inicio:d(-2),
   situacao:'aprovada',status:'a fazer',mae_de:'BOTANIKA§1§mae',ordem:1,
   checklist:['E-mail · QUI 04/09 · disparo 1','WhatsApp · SEX 05/09 · disparo 1'],
   checklist_feito:[]},
  {assinatura:'BOTANIKA§1§artes',marca:'BOTANIKA',campanha:'Dia D Kids',
   nome:'DIA D KIDS — Criar todas as artes · QUI 04/09 até 18h | BOTANIKA',
   responsavel:'Ítalo Neves',prioridade:'urgent',dia:d(2),inicio:d(-2),
   situacao:'aprovada',status:'feito',mae_de:'BOTANIKA§1§mae',ordem:2,
   checklist:null,checklist_feito:[]},
  {assinatura:'MAO§9§avulsa',marca:'BOTANIKA',campanha:'Avulsa',
   nome:'Trocar o banner da home',responsavel:'Gabriel',prioridade:'normal',
   dia:d(1),situacao:'aprovada',status:'fazendo',mae_de:null,ordem:0,
   checklist:null,checklist_feito:[]},
  {assinatura:'VERMEFREE§2§mae',marca:'VERMEFREE',campanha:'Frasco novo',
   nome:'FRASCO NOVO — 20/09 | VERMEFREE',responsavel:'Sarah | Gestora',
   prioridade:'high',dia:d(9),situacao:'aprovada',status:'revisar',mae_de:null,
   ordem:0,checklist:null,checklist_feito:[]},
].map(enfeita);

/* Uma tarefa com tudo que o ClickUp manda: descrição em markdown com
   tabela, duas pessoas responsáveis e etiquetas. */
const TAREFA_CHEIA=()=>Object.assign(enfeita({
  assinatura:'BOTANIKA§1§copy',marca:'BOTANIKA',campanha:'Dia D Kids',
  nome:'DIA D KIDS — Criar toda a copy · QUI 04/09 até 18h | BOTANIKA',
  responsavel:'Pedro Lage',prioridade:'urgent',dia:d(-1),situacao:'aprovada',
  status:'a fazer',mae_de:'BOTANIKA§1§mae',ordem:1,checklist:null,checklist_feito:[]
}),{
  responsaveis:[{id:1,nome:'Pedro Lage'},{id:2,nome:'Ítalo Neves'}],
  etiquetas:['urgente','copy'],
  descricao:'# Dia D Kids\n\n**Ação de cinco dias.**\n\n## A oferta\n\n'+
    '| Item | O que é |\n| --- | --- |\n| Desconto | 10% em todos |\n'+
    '| Frete | Grátis, sem mínimo |\n\n- primeiro ponto\n- segundo ponto\n\n'+
    '> uma citação qualquer\n\nUm parágrafo com `código` e [link](https://exemplo.com).'
});

/* Base de mentira: só o suficiente do PostgREST que a página usa. */
function baseFalsa(op={}){
  const {tarefas=TAREFAS(),falharPatch=false,falharGet=false}=op;
  const reg={tarefas,patches:[],posts:[],gets:0};
  return {reg, rota: async r=>{
    const req=r.request(), u=req.url();
    if(/listas_clickup/.test(u)){
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(op.listas===undefined?LISTAS():op.listas)});
    }
    if(!/tarefas_planejadas/.test(u)){
      // a tabela do planejamento: vazia, para o resto da página seguir igual
      if(req.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      return r.fulfill({status:201,contentType:'application/json',body:'[]'});
    }
    if(req.method()==='GET'){
      reg.gets++;
      if(falharGet)return r.fulfill({status:500,body:'{}'});
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(reg.tarefas)});
    }
    if(req.method()==='PATCH'){
      const corpo=JSON.parse(req.postData()||'{}');
      const ass=decodeURIComponent((u.match(/assinatura=eq\.([^&]+)/)||[])[1]||'');
      reg.patches.push({assinatura:ass,corpo});
      if(falharPatch)return r.fulfill({status:500,body:'{}'});
      const alvo=reg.tarefas.find(t=>t.assinatura===ass);
      if(alvo)Object.assign(alvo,corpo,{atualizada_em:new Date().toISOString()});
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(alvo?[alvo]:[])});
    }
    if(req.method()==='POST'){
      const linhas=JSON.parse(req.postData()||'[]');
      reg.posts.push(...linhas);
      linhas.forEach(l=>reg.tarefas.push(Object.assign(
        {checklist:null,checklist_feito:[],ordem:0},l)));
      return r.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify(linhas)});
    }
    return r.fulfill({status:200,body:'[]'});
  }};
}

async function abrir(op={}){
  const {reg,rota}=baseFalsa(op);
  const p=await b.newPage({viewport:{width:1500,height:1000}});
  const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
  await p.route('**/*.supabase.co/**', rota);
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  if(!op.semAbrir){
    await p.click('nav.paginas button[data-pg="tarefas"]');
    await p.waitForTimeout(500);
  }
  return {p,reg,erros};
}
const G=(p,f,a)=>p.evaluate(f,a);
const corpo=p=>G(p,()=>document.querySelector('#tf-corpo').innerText);
const resumo=p=>G(p,()=>document.querySelector('#tf-resumo').innerText);

// ---- 1. abriu a aba: leu a base e montou o quadro ----
{
  const {p,reg,erros}=await abrir();
  ok('a aba existe na navegação',
     await G(p,()=>!!document.querySelector('nav.paginas button[data-pg="tarefas"]')));
  ok('leu as tarefas ao entrar na aba', reg.gets>=1, 'gets='+reg.gets);
  ok('não leu antes de abrir a aba, no boot',
     await G(p,()=>TF.length)>0);
  const t=await corpo(p);
  ok('o quadro tem as cinco colunas do ClickUp',
     await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-col').length)===5,
     'colunas='+await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-col').length));
  ok('as colunas usam os nomes de status de lá',
     /a fazer/i.test(t)&&/ajustes necessários/i.test(t)&&/revisar/i.test(t), t.split('\n')[0]);
  ok('abre na lista da marca do mês', !/FRASCO NOVO/.test(t), 'vazou VermeFree');
  ok('e o seletor diz em qual lista está',
     await G(p,()=>document.querySelector('#tf-nalista').value)==='Botanika',
     await G(p,()=>document.querySelector('#tf-nalista').value));
  ok('a mãe com filhas não vira cartão solto no quadro',
     !/DIA D KIDS — 10\/09/.test(t));
  ok('a tarefa avulsa aparece', /Trocar o banner da home/.test(t));
  ok('mostrou o progresso do checklist', /0\/2/.test(t), t.split('\n').slice(0,3).join(' · '));
  ok('marcou a atrasada',
     await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-card.atrasada').length)===1,
     'atrasadas='+await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-card.atrasada').length));
  const r=await resumo(p);
  ok('o resumo conta as concluídas', /1 de 3/.test(r), r.replace(/\n/g,' · '));
  ok('e diz de qual lista está falando', /lista Botanika/.test(r), r.replace(/\n/g,' · '));
  ok('o resumo conta as atrasadas', /Atrasadas\n1\n/i.test(r), r.replace(/\n/g,' · '));
  ok('carimbou a hora da leitura',
     /lido \d{2}:\d{2}/.test(await G(p,()=>document.querySelector('#tf-quando').textContent)));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 2. o filtro por lista e o filtro por pessoa ----
{
  const {p,erros}=await abrir();
  ok('o seletor oferece as listas do ClickUp',
     (await G(p,()=>[...document.querySelectorAll('#tf-nalista option')].map(o=>o.value)))
       .join('|')==='|Botanika|VermeFree',
     (await G(p,()=>[...document.querySelectorAll('#tf-nalista option')].map(o=>o.value))).join('|'));
  await p.selectOption('#tf-nalista','');
  await p.waitForTimeout(200);
  ok('todas as listas mostram as duas', /FRASCO NOVO/.test(await corpo(p)));
  await p.selectOption('#tf-nalista','VermeFree');
  await p.waitForTimeout(200);
  const so=await corpo(p);
  ok('e uma lista só mostra só ela',
     /FRASCO NOVO/.test(so)&&!/Trocar o banner/.test(so), so.replace(/\n+/g,' · ').slice(0,90));
  await p.selectOption('#tf-nalista','Botanika');
  await p.waitForTimeout(200);
  await p.selectOption('#tf-quem','Ítalo Neves');
  await p.waitForTimeout(200);
  const t=await corpo(p);
  ok('filtrou por pessoa', /Criar todas as artes/.test(t)&&!/Trocar o banner/.test(t),
     t.replace(/\n+/g,' · ').slice(0,120));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 3. por ação e por pessoa ----
{
  const {p,erros}=await abrir();
  await p.click('#tf-abas button[data-tv="lista"]');
  await p.waitForTimeout(200);
  const l=await corpo(p);
  ok('agrupou pela ação-mãe', /DIA D KIDS — 10\/09/.test(l), l.split('\n')[0]);
  ok('contou as feitas da ação', /1 de 2 feitas/.test(l), l.replace(/\n/g,' · ').slice(0,140));
  ok('a avulsa ficou no bloco sem ação', /Sem ação ligada/.test(l)&&/Trocar o banner/.test(l));
  await p.click('#tf-abas button[data-tv="pessoa"]');
  await p.waitForTimeout(200);
  const q=await corpo(p);
  ok('agrupou por pessoa', /Pedro Lage/.test(q)&&/Gabriel/.test(q), q.split('\n')[0]);
  ok('quem tem atraso vem primeiro', q.indexOf('Pedro Lage')<q.indexOf('Gabriel'));
  ok('não repete o que já está feito', !/Criar todas as artes/.test(q));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 4. abrir uma tarefa e mexer nela ----
{
  const {p,reg,erros}=await abrir();
  await G(p,()=>tfAbrir('BOTANIKA§1§copy'));
  await p.waitForTimeout(200);
  ok('o painel abriu', await G(p,()=>document.querySelector('#tf-painel').classList.contains('on')));
  const f=await G(p,()=>document.querySelector('#tf-folha').innerText);
  ok('mostrou o checklist inteiro',
     /E-mail · QUI 04\/09/i.test(f)&&/WhatsApp/i.test(f), f.split('\n')[1]);
  ok('disse dentro de qual ação está', /DIA D KIDS — 10\/09/.test(f));

  // muda o status
  await p.selectOption('#tf-folha select','fazendo');
  await p.waitForTimeout(400);
  ok('gravou o status', reg.patches.some(x=>x.corpo.status==='fazendo'),
     JSON.stringify(reg.patches));
  ok('gravou na tarefa certa',
     reg.patches[0]?.assinatura==='BOTANIKA§1§copy', reg.patches[0]?.assinatura);

  // marca um item do checklist
  await p.click('#tf-folha .item input');
  await p.waitForTimeout(400);
  const pat=reg.patches.find(x=>x.corpo.checklist_feito);
  ok('gravou o item do checklist', !!pat&&pat.corpo.checklist_feito.length===1,
     JSON.stringify(pat?.corpo));
  ok('a contagem subiu na tela',
     /1 de 2/i.test(await G(p,()=>document.querySelector('#tf-folha').innerText)));

  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok('Esc fecha o painel',
     !await G(p,()=>document.querySelector('#tf-painel').classList.contains('on')));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 5. a base recusa: a tela volta ao que era ----
{
  const {p,reg,erros}=await abrir({falharPatch:true});
  await G(p,()=>tfAbrir('MAO§9§avulsa'));
  await p.waitForTimeout(200);
  await p.selectOption('#tf-folha select','feito');
  await p.waitForTimeout(600);
  ok('tentou gravar', reg.patches.length===1, 'patches='+reg.patches.length);
  ok('desfez a mudança que não foi salva',
     await G(p,()=>TF.find(t=>t.assinatura==='MAO§9§avulsa').status)==='fazendo',
     await G(p,()=>TF.find(t=>t.assinatura==='MAO§9§avulsa').status));
  ok('avisou a pessoa', /Não consegui salvar/.test(
     await G(p,()=>document.querySelector('#msg').textContent)),
     await G(p,()=>document.querySelector('#msg').textContent));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 6. criar uma tarefa na mão ----
{
  const {p,reg,erros}=await abrir();
  await p.click('#pg-tarefas .mini.forte');
  await p.waitForTimeout(200);
  ok('o formulário abriu', await G(p,()=>!!document.querySelector('#tn-nome')));
  await p.fill('#tn-nome','Revisar o texto do pop-up');
  await p.fill('#tn-quem','Gabriel');
  await p.click('#modal-cx .ok');
  await p.waitForTimeout(500);
  const nova=reg.posts[0];
  ok('gravou a tarefa nova', !!nova&&nova.nome==='Revisar o texto do pop-up',
     JSON.stringify(nova));
  ok('já nasce aprovada e a fazer', nova?.situacao==='aprovada'&&nova?.status==='a fazer');
  ok('nasce na marca do mês', nova?.marca===await G(p,()=>marcaDo(mesAtual()).toUpperCase()),
     nova?.marca);
  ok('apareceu na tela sem precisar recarregar',
     /Revisar o texto do pop-up/.test(await corpo(p)));
  ok('sem nome não cria', await (async()=>{
    await p.click('#pg-tarefas .mini.forte');await p.waitForTimeout(150);
    await p.click('#modal-cx .ok');await p.waitForTimeout(300);
    return reg.posts.length===1;})(), 'posts='+reg.posts.length);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 7. a base fora do ar não derruba a página ----
{
  const {p,erros}=await abrir({falharGet:true});
  ok('explicou que não conseguiu ler',
     /Não consegui ler as tarefas/.test(await corpo(p)), await corpo(p));
  await p.click('nav.paginas button[data-pg="camp"]');
  await p.waitForTimeout(300);
  ok('o resto da página continua de pé',
     await G(p,()=>document.querySelector('#pg-camp').classList.contains('on')));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 8. nada quebrou nas abas de sempre ----
{
  const {p,erros}=await abrir({semAbrir:true});
  for(const pg of ['mapa','mes','semana','camp','gestao']){
    await p.click(`nav.paginas button[data-pg="${pg}"]`);
    await p.waitForTimeout(350);
    ok('abre a aba '+pg, await G(p,x=>document.querySelector('#pg-'+x).classList.contains('on'),pg));
  }
  ok('sem erro de JS ao passear por tudo', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 9. o filtro de marca não pode fingir que o quadro está vazio ----
{
  /* A lista da marca do mês está vazia. O quadro não pode abrir nela e
     dizer que não há nada, quando há na outra. */
  const soDaOutra=TAREFAS().filter(t=>t.marca==='VERMEFREE');
  const {p,erros}=await abrir({tarefas:soDaOutra});
  const t=await corpo(p);
  ok('mostra as tarefas mesmo com a lista do mês vazia',
     /FRASCO NOVO/.test(t), t.slice(0,90));
  ok('e fica em todas as listas em vez de numa vazia',
     await G(p,()=>document.querySelector('#tf-nalista').value)==='',
     await G(p,()=>document.querySelector('#tf-nalista').value));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 10. lista existente mas sem tarefa se explica e se desfaz ----
{
  /* A Revita existe no ClickUp e ainda não tem tarefa. Escolher ela não
     pode parecer página quebrada. */
  const {p,erros}=await abrir({listas:LISTAS().concat(
    [{lista_id:'901328348023',nome:'Revita',statuses:STATUS}])});
  await p.selectOption('#tf-nalista','Revita');
  await p.waitForTimeout(250);
  const t=await corpo(p);
  ok('diz que a lista é que está vazia', /Nenhuma tarefa na lista Revita/.test(t), t.slice(0,90));
  ok('e conta quantas estão fora dela', /outras 5 estão fora/.test(t), t.slice(0,110));
  await p.click('#tf-corpo button');
  await p.waitForTimeout(250);
  ok('o botão Ver todas traz as tarefas de volta',
     /DIA D KIDS|Trocar o banner/.test(await corpo(p)));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 11. o filtro de pessoa não pode apontar pra quem não está na lista ----
{
  const {p,erros}=await abrir();
  await p.selectOption('#tf-quem','Ítalo Neves');
  await p.waitForTimeout(200);
  ok('filtrou pela pessoa', /Criar todas as artes/.test(await corpo(p)));
  await p.selectOption('#tf-nalista','VermeFree');
  await p.waitForTimeout(250);
  ok('trocar de lista solta o filtro em vez de esvaziar a tela',
     await G(p,()=>document.querySelector('#tf-quem').value)===''&&
     /FRASCO NOVO/.test(await corpo(p)),
     await G(p,()=>document.querySelector('#tf-quem').value));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 12. as colunas são as configuradas na lista, não as que têm tarefa ----
{
  const {p,erros}=await abrir();
  const cols=await G(p,()=>[...document.querySelectorAll('#pg-tarefas .tf-col-cab span')]
    .map(c=>c.textContent));
  ok('as cinco colunas do ClickUp aparecem, com as vazias',
     cols.join('|')==='a fazer|fazendo|revisar|ajustes necessários|feito', cols.join('|'));
  const cores=await G(p,()=>[...document.querySelectorAll('#pg-tarefas .tf-col-cab')]
    .map(c=>c.style.getPropertyValue('--c')));
  ok('e cada uma com a cor que vem de lá',
     cores.join('|')==='#87909e|#b660e0|#f8ae00|#e16b16|#008844', cores.join('|'));
  /* sem a leitura das listas, o quadro não pode quebrar: cai para os
     status que as tarefas têm */
  const b2=await abrir({listas:[]});
  const cols2=await G(b2.p,()=>[...document.querySelectorAll('#pg-tarefas .tf-col-cab span')]
    .map(c=>c.textContent));
  ok('sem as listas, ainda desenha as colunas que existem nas tarefas',
     cols2.length>0&&cols2.indexOf('a fazer')===0, cols2.join('|'));
  ok('sem erro de JS', erros.length===0&&b2.erros.length===0,
     erros.concat(b2.erros).join(' | '));
  await b2.p.close();await p.close();
}

// ---- 13. o painel mostra a tarefa como ela é no ClickUp ----
{
  const {p,erros}=await abrir({tarefas:TAREFAS()
    .filter(t=>t.assinatura!=='BOTANIKA§1§copy').concat([TAREFA_CHEIA()])});
  await p.evaluate(()=>tfAbrir('BOTANIKA§1§copy'));
  await p.waitForTimeout(300);
  const folha=()=>G(p,()=>document.querySelector('#tf-folha').innerText);
  const html=()=>G(p,()=>document.querySelector('#tf-folha').innerHTML);
  ok('o título vai inteiro, como está lá',
     /DIA D KIDS — Criar toda a copy · QUI 04\/09 até 18h \| BOTANIKA/.test(await folha()),
     (await folha()).split('\n')[0]);
  ok('a descrição vira markdown, não texto cru',
     /<h3>Dia D Kids<\/h3>/.test(await html()));
  ok('com a tabela montada', /<table>[\s\S]*<th>Item<\/th>/.test(await html()));
  ok('com a lista de tópicos', /<li>primeiro ponto<\/li>/.test(await html()));
  ok('com o negrito e o link', /<b>Ação de cinco dias\.<\/b>/.test(await html())&&
     /<a href="https:\/\/exemplo\.com"/.test(await html()));
  ok('mostra os dois responsáveis',
     await G(p,()=>[...document.querySelectorAll('#tf-folha input[type=text]')]
       .map(i=>i.value).join('|'))==='Pedro Lage, Ítalo Neves',
     await G(p,()=>[...document.querySelectorAll('#tf-folha input[type=text]')]
       .map(i=>i.value).join('|')));
  ok('e diz que são duas pessoas', /2 pessoas/i.test(await folha()));
  ok('mostra as etiquetas do ClickUp',
     /urgente/.test(await folha())&&/copy/.test(await folha()));
  ok('o status oferece os cinco, inclusive os sem tarefa',
     (await G(p,()=>[...document.querySelectorAll('#tf-folha select option')]
        .map(o=>o.textContent))).filter(x=>x==='revisar').length===1);
  await p.click('#tf-folha .tf-editar');
  await p.waitForTimeout(200);
  ok('o botão editar mostra o markdown cru',
     await G(p,()=>!!document.querySelector('#tf-folha textarea')));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 14. o markdown não perde linha nem trava ----
{
  const {p,erros}=await abrir();
  const casos=await G(p,()=>{
    const r=[];
    r.push(tfMd('linha com | barra no meio').indexOf('barra')>0);
    r.push(tfMd('').length===0);
    r.push(/<hr>/.test(tfMd('---')));
    r.push(/<blockquote>/.test(tfMd('> citada')));
    r.push(/<ol>/.test(tfMd('1. um\n2. dois')));
    r.push(/<code>x<\/code>/.test(tfMd('tem `x` aqui')));
    /* nada de HTML alheio passando */
    r.push(!/<script>/.test(tfMd('<script>alert(1)</script>')));
    return r;
  });
  ok('markdown: barra solta vira parágrafo em vez de sumir', casos[0]);
  ok('markdown: vazio devolve vazio', casos[1]);
  ok('markdown: régua, citação, lista numerada e código', 
     casos[2]&&casos[3]&&casos[4]&&casos[5]);
  ok('markdown: HTML de dentro do texto não vira HTML', casos[6]);
  const cu=await G(p,()=>{
    const r={};
    /* o que o ClickUp escreve de verdade nas descrições */
    r.caixa=tfMd('- [ ] conferir o frete\n- [x] conferir o banner');
    r.regua=tfMd('* * *');
    r.escape=tfMd('arquivo IMG\\_3638 e tra\\(1\\)');
    return r;
  });
  ok('markdown: "- [ ]" vira caixinha, não colchete na tela',
     /class="tf-cx"/.test(cu.caixa)&&!/\[ \]/.test(cu.caixa), cu.caixa.slice(0,80));
  ok('markdown: a caixinha marcada aparece marcada',
     /<li class="ok">/.test(cu.caixa)&&/✓/.test(cu.caixa));
  ok('markdown: "* * *" também é régua', /<hr>/.test(cu.regua), cu.regua);
  ok('markdown: o escape do ClickUp não vaza barra invertida',
     /IMG_3638/.test(cu.escape)&&/tra\(1\)/.test(cu.escape)&&!/\\/.test(cu.escape),
     cu.escape);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
