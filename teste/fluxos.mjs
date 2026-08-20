/* Percorre os fluxos do app num Chromium headless e imprime OK/FALHA por checagem.
   Rodar com:  npm test          (veja o README) */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  args: ['--no-sandbox'],
});
const p=await b.newPage({viewport:{width:1600,height:1000}});
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
const R=[]; const ok=(n,c,d='')=>R.push([c?'OK ':'FALHA',n,d].join(' | '));
let prompts=[]; // fila de respostas para prompt()
p.on('dialog',async d=>{
  if(d.type()==='prompt'){const v=prompts.shift(); await d.accept(v==null?'':v);}
  else if(d.type()==='confirm'){await d.accept();}
  else {errs.push('ALERT: '+d.message()); await d.accept();}
});
await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
await p.waitForTimeout(400);
const G=(f,a)=>p.evaluate(f,a);

try{
// 1. navegacao
for(const pg of ['mapa','mes','semana','camp']){
  await p.click(`nav.paginas button[data-pg="${pg}"]`); await p.waitForTimeout(200);
  ok('aba '+pg, await G(x=>document.querySelector('.pagina.on')?.id)==='pg-'+pg);
}

// 2. assistente: Dia D
await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(150);
// caminha do passo 2 até criar, passando pela oferta e pelos canais
async function concluirAssistente(){
  await p.click('button.ok'); await p.waitForTimeout(300);          // passo 2 -> 3
  await p.click('button.ok'); await p.waitForTimeout(300);          // passo 3 -> 4
  await p.click('button.ok'); await p.waitForTimeout(450);          // cria
}
const camp0=await G(()=>D.campanhas.length);
await p.click('#lista-camp-mes >> nothing').catch(()=>{});
await p.click('button:has-text("+ nova campanha")'); await p.waitForTimeout(200);
ok('modal abriu', await G(()=>document.querySelector('#modal').classList.contains('on')));
await p.click('.op:has-text("Dia D")'); await p.waitForTimeout(200);
ok('passo2 Dia D inclui os dias de preparação',
   await G(()=>!!document.querySelector('#w-resumo')?.textContent.includes('3 dias de cronograma (1 de venda + 2 de preparação)')),
   await G(()=>document.querySelector('#w-resumo')?.textContent.replace(/\s+/g,' ').slice(0,90)));
await p.fill('#w-nome','TESTE Dia D');
await p.fill('#w-meta','60000'); await p.fill('#w-inv','6000'); await p.waitForTimeout(150);
ok('ROAS recalcula', await G(()=>/ROAS implícito no tráfego: <b>4,0/.test(document.querySelector('#w-resumo').innerHTML)),
   await G(()=>document.querySelector('#w-resumo').textContent.match(/ROAS[^(]*/)?.[0]));
await p.click('button.ok'); await p.waitForTimeout(350);
ok('passo 3 é a oferta', await G(()=>document.querySelector('#modal-cx h3')?.textContent)==='Produtos e desconto');
ok('catálogo real da Shopify no passo 3',
   await G(()=>document.querySelectorAll('#lista-prod .lin').length)===9,
   'linhas='+await G(()=>document.querySelectorAll('#lista-prod .lin').length));
ok('produto traz SKU e preço',
   await G(()=>/SKU 80\.1\.1/.test(document.querySelector('#lista-prod').textContent)&&
              /87,50/.test(document.querySelector('#lista-prod').textContent)));
// tira o Whey da ação e põe um produto de fora
await p.uncheck('#lista-prod .lin[data-sku="80.1.8"] input[type=checkbox]'); await p.waitForTimeout(120);
await p.fill('#w-extras','Combo Fitness · 15% OFF');
await p.fill('#w-brinde','Coqueteleira acima de R$ 400');
await p.click('button.ok'); await p.waitForTimeout(350);
ok('passo 4 são os canais',
   await G(()=>/verba/i.test(document.querySelector('#modal-cx h3')?.textContent||'')));
ok('6 canais de receita já divididos',
   await G(()=>AS.receita.length)===6, 'canais='+await G(()=>AS.receita.length));
ok('soma dos canais bate com a meta',
   await G(()=>/Bate certo com a meta/.test(document.querySelector('#w-soma').textContent)),
   await G(()=>document.querySelector('#w-soma').textContent.replace(/\s+/g,' ').slice(0,110)));
ok('11 canais de execução ligados',
   await G(()=>document.querySelectorAll('.lin[data-canal]').length)===11);
await p.uncheck('.lin[data-canal="Página de captura"] input[type=checkbox]'); await p.waitForTimeout(120);
await p.click('button.ok'); await p.waitForTimeout(450);
ok('campanha criada', await G(()=>D.campanhas.length)===camp0+1);
// o que foi escolhido chegou no TAP
const of=await G(()=>{
  const c=D.campanhas.at(-1),por={};c.secoes.forEach(s=>por[s.t]=s);
  return {oferta:por['SOBRE A OFERTA'].l.map(r=>r.join(' | ')),
          evento:Object.fromEntries(por['SOBRE O EVENTO'].l),
          canais:por['CANAIS · CRONOGRAMA'].l.map(r=>r[0]),
          metas:por['METAS'].l.map(r=>r.join(' | '))};
});
ok('produto desmarcado sai da oferta', !of.oferta.some(l=>/^Whey/.test(l)),
   of.oferta.map(l=>l.split(' | ')[0]).join(', '));
ok('8 produtos restantes na oferta', of.oferta.filter(l=>/SKU/.test(l)).length===8);
ok('produto de fora do catálogo entra', of.oferta.some(l=>/Combo Fitness/.test(l)));
ok('brinde entra no evento e na oferta',
   /Coqueteleira/.test(of.evento['Brinde']||'') && of.oferta.some(l=>/Coqueteleira/.test(l)));
ok('canal desmarcado sai do cronograma', !of.canais.includes('Página de captura'),
   'canais='+of.canais.length);
ok('METAS traz meta por canal', of.metas.filter(l=>/^Meta faturamento — /.test(l)).length===6,
   of.metas.filter(l=>/Meta faturamento/.test(l)).length+' linhas');
ok('METAS traz investimento por canal', of.metas.some(l=>/^Investimento — Tráfego/.test(l)),
   of.metas.filter(l=>/^Investimento/.test(l)).join(' / '));
ok('TAP gerado', await G(()=>D.campanhas.at(-1).secoes.length)>=5, 'secoes='+await G(()=>D.campanhas.at(-1).secoes.length));
ok('pilula no mapa', await G(()=>D.mapas[0].nos.some(n=>n.t==='TESTE Dia D')));
ok('barra no calendario', await G(()=>document.querySelectorAll('#calendario .barra, #calendario [class*=barra]').length)>0,
   'barras='+await G(()=>document.querySelectorAll('#calendario .barra, #calendario [class*=barra]').length));

// 3. semana tematica com tema novo
await p.click('button:has-text("+ nova campanha")'); await p.waitForTimeout(200);
await p.click('.op:has-text("Semana temática")'); await p.waitForTimeout(200);
ok('passo tema apareceu', await G(()=>document.querySelector('#modal-cx h3')?.textContent)==='Qual tema');
prompts=['Energia'];
await p.click('.op:has-text("+ novo tema")'); await p.waitForTimeout(300);
ok('tema novo no catalogo', await G(()=>D.temas.includes('Energia')), 'temas='+await G(()=>D.temas.join(',')));
ok('nome auto', await G(()=>document.querySelector('#w-nome')?.value)==='Semana Energia');
ok('semana: 5 de venda + 2 de preparação',
   await G(()=>document.querySelector('#w-resumo')?.textContent.includes('7 dias de cronograma (5 de venda + 2 de preparação)')),
   await G(()=>document.querySelector('#w-resumo')?.textContent.replace(/\s+/g,' ').slice(0,80)));
await concluirAssistente();
ok('semana criada', await G(()=>D.campanhas.length)===camp0+2);
ok('cronograma: Canal + Base + 7 dias + Quem faz', await G(()=>{
  const cr=D.campanhas.at(-1).secoes.find(s=>/cronograma/i.test(s.t));
  return cr? cr.c.length : 0;})===10, 'colunas='+await G(()=>{
  const cr=D.campanhas.at(-1).secoes.find(s=>/cronograma/i.test(s.t));return cr?cr.c.join(' '):'n/a'}));
// TAP PRÉ-PREENCHIDO
const tap=await G(()=>{
  const c=D.campanhas.at(-1), por={};c.secoes.forEach(s=>por[s.t]=s);
  // linhas de total legitimamente não têm responsável — não contam como buraco
  const vazias=c.secoes.flatMap(s=>s.l.filter((_,i)=>!(s.tot||[]).includes(i)))
                       .flat().filter(v=>v==='').length;
  const cron=por['CANAIS · CRONOGRAMA'];
  return {secoes:c.secoes.map(s=>s.t), vazias,
    evento:Object.fromEntries(por['SOBRE O EVENTO'].l),
    oferta:por['SOBRE A OFERTA'].l.map(r=>r[0]+' :: '+r[1]),
    equipe:por['EQUIPE']?por['EQUIPE'].l.length:0,
    ritmoEmail:cron.l[0].slice(2,-1),
    celulasVazias:cron.l.flat().filter(v=>v==='').length};
});
ok('nasce com a seção EQUIPE', tap.equipe===3, 'linhas='+tap.equipe);
ok('nenhuma célula em branco no TAP (fora as linhas de total)', tap.vazias===0, 'em branco='+tap.vazias);
ok('cupom já preenchido', /10% OFF/.test(tap.evento['Cupom automático']||''), tap.evento['Cupom automático']);
ok('bônus já preenchidos', /Manual da Suplementação/.test(tap.evento['Bônus universal']||''));
ok('uma linha por produto, com SKU e preço',
   tap.oferta.filter(l=>/SKU/.test(l)).length===9 &&
   tap.oferta.some(l=>/Tri\[Mg\]/.test(l)) && tap.oferta.some(l=>/Ômega 3/.test(l)),
   tap.oferta.filter(l=>/SKU/.test(l)).length+' produtos');
ok('oferta traz kit e frete', tap.oferta.some(l=>/Kit Imunidade/.test(l))&&tap.oferta.some(l=>/Frete grátis/.test(l)));
ok('cronograma com ritmo por fase, não traços',
   tap.ritmoEmail.filter(v=>v!=='—').length>=5, 'e-mails='+JSON.stringify(tap.ritmoEmail));
ok('cronograma abre e fecha diferente do meio',
   tap.ritmoEmail[2]!==tap.ritmoEmail[tap.ritmoEmail.length-1], JSON.stringify(tap.ritmoEmail));
ok('cronograma com os 11 canais', await G(()=>{
  const cr=D.campanhas.at(-1).secoes.find(s=>/cronograma/i.test(s.t));return cr?cr.l.length:0})===11);

// 3b. OPÇÃO LIVRE
const nos0=await G(()=>M().nos.length), camps=await G(()=>D.campanhas.length);
await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(150);
await p.click('button:has-text("+ nova campanha")'); await p.waitForTimeout(250);
ok('opção Livre existe no modal', await G(()=>!!document.querySelector('#modal .op.livre')));
await p.click('#modal .op.livre'); await p.waitForTimeout(500);
ok('Livre fecha o modal', await G(()=>!document.querySelector('#modal').classList.contains('on')));
ok('Livre leva pro mapa', await G(()=>document.querySelector('.pagina.on')?.id)==='pg-mapa');
ok('Livre cria um nó', await G(()=>M().nos.length)===nos0+1, `${nos0} -> `+await G(()=>M().nos.length));
ok('Livre NÃO cria campanha nem TAP', await G(()=>D.campanhas.length)===camps);
ok('Livre já entra em modo de escrita', await G(()=>editando)===true);
await p.keyboard.type('anotação solta'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
ok('Livre grava o que foi escrito', await G(()=>M().nos.some(n=>n.t==='anotação solta')),
   'nós='+await G(()=>M().nos.map(n=>n.t).slice(-2).join(' | ')));

// 4. novo mes
prompts=['09/2026','400000'];
await p.click('button:has-text("+ novo mês")'); await p.waitForTimeout(500);
ok('mes criado', await G(()=>D.meses.length)===2, 'meses='+await G(()=>D.meses.map(m=>m.mes+'/'+m.ano).join(' ')));
ok('mapa proprio do mes', await G(()=>D.mapas.length)===2);
ok('titulo trocou', /[Ss]etembro/.test(await G(()=>document.querySelector('#tit-mes').textContent)),
   await G(()=>document.querySelector('#tit-mes').textContent));
ok('campanhas filtradas p/ o mes', await G(()=>document.querySelectorAll('#abas .aba').length)===0
   || await G(()=>campsMes().length)===0, 'campsMes='+await G(()=>campsMes().length));
await p.selectOption('#sel-mes','1'); await p.waitForTimeout(400);
ok('voltou p/ agosto', await G(()=>campsMes().length)===3, 'campsMes='+await G(()=>campsMes().length));

// 5. TAP: editar, duplicar, regerar, excluir
await p.click('nav.paginas button[data-pg="camp"]'); await p.waitForTimeout(250);
const nAbas=await G(()=>document.querySelectorAll('#abas .aba:not(.nova)').length);
ok('abas do TAP', nAbas===3, 'abas='+nAbas);
const cel=await p.$('#secoes td .cel');
await cel.click(); await p.keyboard.type('EDITADO'); await G(()=>document.activeElement.blur()); await p.waitForTimeout(250);
ok('celula edita e persiste no modelo',
   await G(()=>JSON.stringify(D.campanhas).includes('EDITADO')));
await p.click('button:has-text("Duplicar TAP")'); await p.waitForTimeout(400);
ok('TAP duplicado', await G(()=>D.campanhas.length)===camp0+3);
const secAntes=await G(()=>D.campanhas[ativa].secoes.length);
await p.click('button:has-text("Regerar cronograma")'); await p.waitForTimeout(400);
ok('regerar cronograma nao quebra', await G(()=>D.campanhas[ativa].secoes.length)===secAntes,
   `antes=${secAntes} depois=`+await G(()=>D.campanhas[ativa].secoes.length));
await p.click('button:has-text("Excluir TAP")'); await p.waitForTimeout(400);
ok('TAP excluido', await G(()=>D.campanhas.length)===camp0+2);

// 6. exportar / importar
const json=await G(()=>JSON.stringify(D));
await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(150);
await p.click('button:has-text("Zerar")').catch(()=>{}); await p.waitForTimeout(400);
ok('zerar limpa', await G(()=>D.campanhas.length)===0, 'camps='+await G(()=>D.campanhas.length));
await G(j=>{D=JSON.parse(j);tudo()},json); await p.waitForTimeout(300);
ok('restaura do JSON', await G(()=>D.campanhas.length)===camp0+2);

// 7. mapa: ferramentas, undo/redo, zoom
await p.click('nav.paginas button[data-pg="mapa"]'); await p.waitForTimeout(400);
const itens0=await G(()=>M().itens.length);
await p.click('[data-fer="sticky"]'); await p.waitForTimeout(120);
await p.mouse.click(700,600); await p.waitForTimeout(300);
ok('nota adesiva criada', await G(()=>M().itens.length)===itens0+1, 'itens='+await G(()=>M().itens.length));
await p.keyboard.press('Escape');
ok('botao desfazer habilitou', await G(()=>!document.querySelector('#b-undo').disabled), 'pilha='+await G(()=>pilha.length));
await p.click('#b-undo'); await p.waitForTimeout(300);
ok('desfazer', await G(()=>M().itens.length)===itens0, 'itens='+await G(()=>M().itens.length));
await p.click('#b-redo'); await p.waitForTimeout(300);
ok('refazer', await G(()=>M().itens.length)===itens0+1);
const z0=await G(()=>Z);
await p.click('#zoomcx button:has-text("+")'); await p.waitForTimeout(200);
ok('zoom in', await G(()=>Z)>z0);
await p.click('#zoomcx button:has-text("−")'); await p.waitForTimeout(200);
await p.click('#zoomcx button[title="Enquadrar tudo"]'); await p.waitForTimeout(300);
ok('enquadrar', await G(()=>Z)>0.05);

// 7b. LARGURA TOTAL
const boxNormal=await G(()=>{const r=document.querySelector('#quadro').getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height)}});
await p.click('#b-larga'); await p.waitForTimeout(400);
const boxLarga=await G(()=>{const r=document.querySelector('#quadro').getBoundingClientRect();
  const rod=document.querySelector('.rodape').getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),left:Math.round(r.left),
          fim:Math.round(r.bottom),topoRodape:Math.round(rod.top),vw:innerWidth,vh:innerHeight}});
ok('largura total encosta nas duas bordas', boxLarga.left===0&&boxLarga.w===boxLarga.vw, JSON.stringify(boxLarga));
ok('largura total nunca encolhe', boxLarga.w>boxNormal.w && boxLarga.h>=boxNormal.h,
   `${boxNormal.w}x${boxNormal.h} -> ${boxLarga.w}x${boxLarga.h}`);
// janela alta: aí sim tem sobra vertical de verdade pra ocupar
await p.setViewportSize({width:1600,height:1400}); await p.waitForTimeout(400);
const alto=await G(()=>{const r=document.querySelector('#quadro').getBoundingClientRect();
  return {h:Math.round(r.height),vh:innerHeight}});
ok('em janela alta usa a sobra vertical', alto.h>800, `altura=${alto.h} de vh=${alto.vh}`);
await p.setViewportSize({width:1600,height:1000}); await p.waitForTimeout(400);
ok('sem rolagem horizontal', await G(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'scrollWidth='+await G(()=>document.documentElement.scrollWidth));
ok('botao marca estado ligado', await G(()=>document.querySelector('#b-larga').classList.contains('on')));
// redimensionar a janela deve recalcular a altura
await p.setViewportSize({width:1280,height:800}); await p.waitForTimeout(400);
const boxRe=await G(()=>{const r=document.querySelector('#quadro').getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),vw:innerWidth,
          piso:Math.round(Math.min(innerHeight*.74,760))}});
ok('acompanha o resize em largura', boxRe.w===boxRe.vw, JSON.stringify(boxRe));
ok('nunca abaixo do piso do modo normal', boxRe.h>=boxRe.piso, `h=${boxRe.h} piso=${boxRe.piso}`);
ok('sem rolagem horizontal apos resize', await G(()=>document.documentElement.scrollWidth<=innerWidth+1));
await p.setViewportSize({width:1600,height:1000}); await p.waitForTimeout(300);
// tela cheia por cima da largura total
await p.click('#b-cheio'); await p.waitForTimeout(400);
const boxCheio=await G(()=>{const r=document.querySelector('#quadro').getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),vw:innerWidth,vh:innerHeight,
          larga:document.querySelector('#quadro').classList.contains('larga')}});
ok('tela cheia ocupa a janela', boxCheio.w===boxCheio.vw&&boxCheio.h===boxCheio.vh, JSON.stringify(boxCheio));
ok('tela cheia desliga largura total', boxCheio.larga===false);
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok('Esc volta ao normal', await G(()=>{const q=document.querySelector('#quadro');
  return !q.classList.contains('cheio')&&!q.classList.contains('larga')&&q.style.height===''}));
// atalhos
await p.keyboard.press('w'); await p.waitForTimeout(350);
ok('atalho W liga largura total', await G(()=>document.querySelector('#quadro').classList.contains('larga')));
await p.keyboard.press('Escape'); await p.waitForTimeout(250);
await p.keyboard.press('f'); await p.waitForTimeout(350);
ok('atalho F liga tela cheia', await G(()=>document.querySelector('#quadro').classList.contains('cheio')));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);

// 7c. os demais controles de dentro do canvas (o bug do pointer capture)
await p.click('[data-fer="texto"]'); await p.waitForTimeout(150);
ok('ferramenta texto responde ao clique', await G(()=>fer)==='texto', 'fer='+await G(()=>fer));
await p.keyboard.press('Escape');
await p.click('[data-fer="forma"]'); await p.waitForTimeout(200);
ok('menu de formas abre', await G(()=>document.querySelector('#subformas').classList.contains('on')));
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
const zA=await G(()=>Z);
await p.click('#zoomcx button:has-text("+")'); await p.waitForTimeout(250);
ok('botao + do zoom', await G(()=>Z)>zA, `${zA.toFixed(2)} -> `+await G(()=>Z.toFixed(2)));
await p.click('#zoomcx button:has-text("−")'); await p.waitForTimeout(250);
ok('botao − do zoom', Math.abs(await G(()=>Z)-zA)<0.01);
await p.click('#zpc'); await p.waitForTimeout(250);
ok('clicar na porcentagem volta a 100%', await G(()=>Z)===1, 'Z='+await G(()=>Z));
await p.click('#zoomcx button[title="Enquadrar tudo"]'); await p.waitForTimeout(300);
ok('botao enquadrar', await G(()=>Z)!==1);
await p.fill('#q-nome','Mapa renomeado'); await p.waitForTimeout(200);
ok('renomear o mapa', await G(()=>M().nome)==='Mapa renomeado');

// 7d. a paleta não pode cobrir os controles do topo do canvas
await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(200);
await p.click('nav.paginas button[data-pg="mapa"]'); await p.waitForTimeout(600);
const pal=await G(()=>{
  const pl=document.querySelector('#paleta'), tt=document.querySelector('#titulo-q');
  if(!pl.classList.contains('on'))return {off:true};
  const a=pl.getBoundingClientRect(), t=tt.getBoundingClientRect();
  const no=document.querySelector('#mundo .el.sel')?.getBoundingClientRect();
  return {sobrepoe:!(a.right<t.left||a.left>t.right||a.bottom<t.top||a.top>t.bottom),
          acimaDoNo: no? Math.round(no.top-a.bottom) : null};
});
ok('paleta não cobre nome do mapa e busca', pal.off||!pal.sobrepoe, JSON.stringify(pal));
ok('paleta ancorada logo acima do nó selecionado', pal.off||(pal.acimaDoNo>=0&&pal.acimaDoNo<30),
   'folga='+pal.acimaDoNo);
// e continua ancorada depois de dar zoom
await p.click('#zoomcx button:has-text("+")'); await p.waitForTimeout(300);
ok('paleta segue o nó no zoom', await G(()=>{
  const pl=document.querySelector('#paleta').getBoundingClientRect();
  const no=document.querySelector('#mundo .el.sel')?.getBoundingClientRect();
  return !no || (no.top-pl.bottom>=0 && no.top-pl.bottom<30)}));
await p.click('#zoomcx button[title="Enquadrar tudo"]'); await p.waitForTimeout(300);

// 8. busca
await p.fill('#busca-q','RMKT'); await p.waitForTimeout(300);
ok('busca destaca e apaga o resto', await G(()=>document.querySelectorAll('.el.achado').length)===1
   && await G(()=>document.querySelectorAll('.el.apagado').length)>3,
   'achado='+await G(()=>document.querySelectorAll('.el.achado').length)
   +' apagado='+await G(()=>document.querySelectorAll('.el.apagado').length));
await p.fill('#busca-q','');

// 9. semana
await p.click('nav.paginas button[data-pg="semana"]'); await p.waitForTimeout(300);
ok('seletor de semanas', await G(()=>document.querySelectorAll('#sel-semana button').length)>=4,
   'n='+await G(()=>document.querySelectorAll('#sel-semana button').length));
const bs=await p.$$('#sel-semana button');
if(bs[1]){await bs[1].click(); await p.waitForTimeout(250);}
ok('troca de semana', await G(()=>semanaSel)===1, 'semanaSel='+await G(()=>semanaSel));
ok('canais da semana', await G(()=>document.querySelectorAll('#canais-semana *').length)>0);

// 10. clique no dia do calendario
await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(250);
const dia=await p.$('#calendario .dia, #calendario [class*=dia]');
if(dia){await dia.click(); await p.waitForTimeout(250);}
ok('detalhe do dia', await G(()=>document.querySelector('#dia-detalhe')?.textContent.trim().length)>0,
   'len='+await G(()=>document.querySelector('#dia-detalhe')?.textContent.trim().length));

}catch(e){R.push('EXCECAO | '+e.message.split('\n')[0])}
console.log(R.join('\n'));
const falhas=R.filter(l=>!l.startsWith('OK')&&l.trim()!==''&&!l.startsWith(' |')).length;
console.log(`\n${R.filter(l=>l.startsWith('OK')).length} OK, ${falhas} falha(s)`);
console.log('--- ERROS DE JS ---\n'+(errs.length?errs.join('\n'):'nenhum'));
await b.close();
process.exit(falhas||errs.length?1:0);
