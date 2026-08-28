/* Exercita o caminho compartilhado com o artifact simulado: fora do
   claude.ai a página cai no modo local e esse código nunca roda. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});

// serve a página com um estado "da equipe" já publicado ao lado
async function abrir({estadoDaEquipe=null, publishFalha=null}={}){
  const p = await b.newPage({viewport:{width:1400,height:900}});
  const erros=[];
  p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/dados/estado-setembro-2026.json*', r=> estadoDaEquipe
    ? r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(estadoDaEquipe)})
    : r.fulfill({status:404,body:''}));
  await p.addInitScript(({falha})=>{
    try{localStorage.clear()}catch(e){}
    window.__publicados=[];
    window.claude={ use: async n => n!=='artifact' ? null : ({
      publish: async files => {
        window.__publicados.push(files);
        if(falha){const e=new Error('simulado');e.code=falha;throw e}
        return {version:'v'+window.__publicados.length};
      }
    })};
  },{falha:publishFalha});
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  await p.waitForTimeout(500);
  return {p,erros};
}
const G=(p,f)=>p.evaluate(f);

// ---- 1. entra em modo compartilhado e adota o estado da equipe ----
{
  const equipe={prox:{mes:3,camp:9,mapa:3},mesAtivo:2,temas:['Imunidade'],
    meses:[{id:2,ano:2026,mes:9,metas:[400000,450000,500000],ref:'vindo da equipe'}],
    mapas:[{id:2,mesId:2,nome:'SETEMBRO DA EQUIPE',layout:'direita',prox:3,proxItem:1,itens:[],
      nos:[{id:1,pai:null,t:'SETEMBRO',cor:0,raizMes:2,x:4500,y:3000}]}],
    campanhas:[{id:8,mesId:2,nome:'Campanha da equipe',tipo:'diaD',meta:50000,
      investimento:5000,inicio:'2026-09-10',fim:'2026-09-10',secoes:[]}]};
  const {p,erros}=await abrir({estadoDaEquipe:equipe});
  ok('entra em modo nuvem', await G(p,()=>modo)==='nuvem', 'modo='+await G(p,()=>modo));
  ok('adota o estado da equipe, não o exemplo',
     await G(p,()=>D.campanhas.map(c=>c.nome).join('|'))==='Campanha da equipe',
     await G(p,()=>D.campanhas.map(c=>c.nome).join('|')));
  ok('mês da equipe no título', /Setembro/i.test(await G(p,()=>document.querySelector('#tit-mes').textContent)),
     await G(p,()=>document.querySelector('#tit-mes').textContent));
  ok('rodapé diz que é compartilhado',
     /compartilhado com a equipe/.test(await G(p,()=>document.querySelector('#msg').textContent)),
     await G(p,()=>document.querySelector('#msg').textContent));
  ok('sem faixa de aviso', !await G(p,()=>document.querySelector('#nuvem').classList.contains('on')));

  // muda algo e espera o envio
  await p.evaluate(()=>{D.campanhas[0].meta=77000});
  await p.waitForTimeout(7000);
  const pub=await G(p,()=>window.__publicados);
  ok('publicou depois de parar de mexer', pub.length>=1, 'publicações='+pub.length);
  ok('publicou só o arquivo de dados',
     pub.length>0 && Object.keys(pub[0]).length===1 && Object.keys(pub[0])[0]==='dados/estado-setembro-2026.json',
     pub.length?Object.keys(pub[0]).join(','):'nenhuma');
  ok('mandou JSON com a mudança',
     pub.length>0 && JSON.parse(pub[0]['dados/estado-setembro-2026.json'].content).campanhas[0].meta===77000);
  ok('declarou o tipo do conteúdo',
     pub.length>0 && pub[0]['dados/estado-setembro-2026.json'].contentType==='application/json');
  ok('sem erro de JS', erros.length===0, erros.join(' / '));
  await p.close();
}

// ---- 2. conflito deixa a decisão com quem está editando ----
{
  const {p}=await abrir({publishFalha:'conflict'});
  await p.evaluate(()=>{D.meses[0].ref='mexido durante o conflito'});
  await p.waitForTimeout(7000);
  const faixa=await G(p,()=>document.querySelector('#nuvem').textContent.replace(/\s+/g,' ').trim());
  ok('faixa de conflito aparece', /Outra pessoa salvou/.test(faixa), faixa.slice(0,60));
  ok('conflito oferece as duas saídas',
     /Ver a versão dela/.test(faixa) && /Mandar a minha por cima/.test(faixa));
  ok('não recarrega sozinho — o trabalho local continua',
     await G(p,()=>D.meses[0].ref)==='mexido durante o conflito');
  await p.close();
}

// ---- 3. quem não pode escrever vê modo leitura, sem quebrar ----
{
  const {p,erros}=await abrir({publishFalha:'not_writer'});
  await p.evaluate(()=>{D.meses[0].ref='mexido em somente leitura'});
  await p.waitForTimeout(7000);
  ok('cai pra somente leitura', await G(p,()=>modo)==='leitura', 'modo='+await G(p,()=>modo));
  ok('explica no lugar de dar erro',
     /somente leitura/.test(await G(p,()=>document.querySelector('#nuvem').textContent)));
  ok('rodapé acompanha',
     /somente leitura/.test(await G(p,()=>document.querySelector('#msg').textContent)),
     await G(p,()=>document.querySelector('#msg').textContent));
  ok('a página segue usável', await G(p,()=>D.meses[0].ref)==='mexido em somente leitura');
  ok('sem erro de JS', erros.length===0, erros.join(' / '));
  await p.close();
}

// ---- 4. sem artifact (arquivo local) segue salvando no navegador ----
{
  const p=await b.newPage();
  await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  await p.waitForTimeout(400);
  ok('fora do claude.ai fica em modo local', await G(p,()=>modo)==='local', 'modo='+await G(p,()=>modo));
  ok('rodapé diz onde salvou',
     /só neste navegador/.test(await G(p,()=>document.querySelector('#msg').textContent)),
     await G(p,()=>document.querySelector('#msg').textContent));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
