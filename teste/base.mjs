/* A base de dados: o planejamento deixa de morar só no navegador.
   Aqui o Supabase é simulado — a suíte nunca fala com a base de verdade —
   e o que se testa é o contrato: o que a página lê, o que ela grava, e o
   que acontece quando a base não responde. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});

/* Uma base de mentira: guarda o que a página grava e devolve o que tem. */
function baseFalsa({linha=null,quebrada=false}={}){
  const reg={linha,posts:[],gets:0};
  return {reg, rota: async r=>{
    const req=r.request();
    if(quebrada)return r.abort();
    if(req.method()==='GET'){
      reg.gets++;
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(reg.linha?[reg.linha]:[])});
    }
    if(req.method()==='POST'){
      const corpo=JSON.parse(req.postData()||'[]')[0]||{};
      reg.posts.push(corpo);
      reg.linha={estado:corpo.estado,versao:(reg.linha?.versao||0)+1};
      return r.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify([reg.linha])});
    }
    return r.fulfill({status:200,body:'[]'});
  }};
}

async function abrir(op={}){
  const {reg,rota}=baseFalsa(op);
  const p=await b.newPage({viewport:{width:1400,height:1000}});
  const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
  await p.route('**/*.supabase.co/**', rota);
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  if(!op.manter)await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForTimeout(700);
  return {p,reg,erros};
}
const G=(p,f)=>p.evaluate(f);
const rodape=p=>G(p,()=>document.querySelector('#msg').textContent);

// ---- 1. base vazia: a página sobe o que tem ----
{
  const {p,reg,erros}=await abrir();
  ok('leu a base ao abrir', reg.gets>=1, 'gets='+reg.gets);
  ok('base vazia recebe o plano desta aba', reg.posts.length===1, 'posts='+reg.posts.length);
  ok('gravou sob a chave do ciclo',
     reg.posts[0]?.chave===await G(p,()=>CHAVE), reg.posts[0]?.chave);
  ok('gravou o estado inteiro, não um pedaço',
     Array.isArray(reg.posts[0]?.estado?.meses)&&reg.posts[0].estado.meses.length>=2,
     'meses='+reg.posts[0]?.estado?.meses?.length);
  ok('identificou quem gravou', /^aba-/.test(reg.posts[0]?.atualizado_por||''),
     reg.posts[0]?.atualizado_por);
  ok('o rodapé diz que está na base', /na base da Botanika/.test(await rodape(p)),
     await rodape(p));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 2. base com plano: é ela que manda, não o navegador ----
{
  /* primeiro deixa uma campanha só no navegador desta aba */
  const {p:p0}=await abrir({quebrada:true});
  const local=await G(p0,()=>{
    AS={noId:null,tipo:'diaD',tema:null,inicio:'2026-09-07',fim:'2026-09-07',meta:10000,
      fontes:{traf:{meta:2000,inv:500},api:{meta:2000,inv:250}},nome:'SÓ NESTE NAVEGADOR',
      produtos:[],modoDesc:'todos',descGeral:0,descPorSku:{},extras:[],canais:[],receita:null};
    AS.inv=invTotal(AS.fontes);criarCampanha();salvar();
    return JSON.stringify(D);
  });
  await p0.close();

  /* e agora a base tem outra coisa */
  const daBase=JSON.parse(local);
  daBase.campanhas[0].nome='VEIO DA BASE';
  const {p,erros}=await abrir({manter:true,linha:{estado:daBase,versao:7}});
  ok('o que está na base ganha do que estava no navegador',
     await G(p,()=>D.campanhas[0]?.nome)==='VEIO DA BASE',
     await G(p,()=>D.campanhas[0]?.nome));
  ok('e a tela foi redesenhada com ele',
     /VEIO DA BASE/.test(await G(p,()=>document.querySelector('#lista-camp-mes').innerText)));
  ok('guardou a versão que veio', await G(p,()=>sbVersao)===7);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 3. o que se edita aqui vai para a base ----
{
  const {p,reg,erros}=await abrir();
  const antes=reg.posts.length;
  await G(p,()=>{const m=mesAtual();m.metas=[500000,585000,665000];m.ticket=250});
  await p.waitForTimeout(4500);   // debounce da base
  ok('a edição virou gravação', reg.posts.length>antes, `${antes} -> ${reg.posts.length}`);
  const ult=reg.posts[reg.posts.length-1];
  ok('com a meta nova dentro', ult?.estado?.meses?.some(m=>m.metas?.[0]===500000));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 4. o que a equipe gravou do outro lado chega aqui ----
{
  const {p,reg,erros}=await abrir();
  const novo=JSON.parse(JSON.stringify(await G(p,()=>D)));
  novo.meses[0].ref='mexido por outra pessoa';
  reg.linha={estado:novo,versao:99};
  await G(p,()=>sbPuxar());
  await p.waitForTimeout(400);
  ok('puxou o que veio de fora', await G(p,()=>D.meses[0].ref)==='mexido por outra pessoa',
     await G(p,()=>D.meses[0].ref));
  ok('e avisou quem está olhando', /equipe gravou/i.test(await rodape(p)), await rodape(p));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 5. base fora do ar: nada quebra ----
{
  const {p,erros}=await abrir({quebrada:true});
  ok('a página abre igual', await G(p,()=>!!document.querySelector('#tit-mes').textContent));
  ok('marcou a base como indisponível', await G(p,()=>sbOk)===false);
  ok('o rodapé volta a dizer onde está salvo',
     /neste navegador|somente leitura|equipe/.test(await rodape(p)), await rodape(p));
  await G(p,()=>{const m=mesAtual();m.metas=[123000,0,0]});
  await p.waitForTimeout(2200);
  ok('e continua salvando no navegador',
     await G(p,()=>{try{return JSON.parse(localStorage.getItem(CHAVE)).meses.some(m=>m.metas[0]===123000)}
       catch(e){return false}}));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
