/* ================= /api/tarefas =================
   O planejamento vive num jsonb no Supabase, atrás de uma chave. Sessões
   do Claude que não têm ferramenta de consulta não conseguem ler nada
   dali — e foi o que aconteceu. Esta rota serve o mesmo dado por HTTP,
   sem chave e sem SQL: basta abrir a URL.

   Não abre nada novo: o planejador já é público e a chave publicável já
   está na página. Isto só entrega em texto o que aquele link mostra.

   Parâmetros, todos opcionais:
     de, ate   datas ISO (padrão: a semana que vem inteira)
     marca     Botanika | VermeFree
     formato   texto (padrão) | json
*/
const SB = 'https://sjkuysdmixfzeerxuudn.supabase.co';
const CHAVE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa3V5c2RtaXhmemVlcnh1dWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTMxNDQsImV4cCI6MjA5NjY4OTE0NH0.oMbvy25V6-W7YvF70zNb1xVfRwH_tGBWp3NPHGtpOtM';

const DOW = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const brl = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:0});

/* O nome da tarefa no padrão que a equipe já usa no ClickUp:
     DIA D KIDS — Criar toda a copy · QUI 27/08 | BOTANIKA
   Assim o que sai daqui entra lá sem ninguém reescrever. */
function nomeDaTarefa(l){
  const d = new Date(l.dia + 'T12:00:00');
  const quando = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${
    String(d.getMonth()+1).padStart(2,'0')}`;
  /* a data já vem no fim do nome de algumas ações ("Dia D — 09/09"); sai
     daqui pra não repetir com a data da própria tarefa */
  const acao = String(l.campanha||'').replace(/\s*[—-]\s*\d{2}\/\d{2}\s*$/,'').trim().toUpperCase();
  const detalhe = l.o_que_sai && l.o_que_sai !== '1' ? ` (${l.o_que_sai})` : '';
  return `${acao} — ${l.canal}${detalhe} · ${quando} | ${String(l.marca||'').toUpperCase()}`;
}

function emTexto(cro, camps, de, ate){
  const L = [];
  L.push(`PLANEJAMENTO · ${de} a ${ate}`);
  L.push(`${cro.length} peças a produzir, em ${new Set(cro.map(x=>x.campanha+'|'+x.marca)).size} ações.`);
  L.push('');

  L.push('AÇÕES DO PERÍODO');
  const porAcao = new Map();
  cro.forEach(l=>{
    const k = l.marca+' · '+l.campanha;
    if(!porAcao.has(k)) porAcao.set(k, []);
    porAcao.get(k).push(l);
  });
  for(const [k, ls] of porAcao){
    const c = camps.find(x => k === x.marca+' · '+x.campanha);
    L.push(`- ${k}${c ? ` · ${c.formato} · ${c.inicio} a ${c.fim} · meta ${brl(c.meta)} · verba ${brl(c.verba)}` : ''} · ${ls.length} peças`);
  }
  L.push('');

  L.push('TAREFAS, NO PADRÃO DO CLICKUP');
  const dias = [...new Set(cro.map(l=>l.dia))].sort();
  for(const dia of dias){
    const doDia = cro.filter(l=>l.dia===dia);
    const d = new Date(dia+'T12:00:00');
    L.push('');
    L.push(`${DOW[d.getDay()]} ${dia} — ${doDia.length} peças`);
    doDia.forEach(l=>{
      L.push(`  ${nomeDaTarefa(l)}`);
      L.push(`     responsável: ${l.quem_faz || '—'}${l.base && l.base !== '—' ? ' · base: ' + l.base : ''}`);
    });
  }
  return L.join('\n');
}

async function busca(caminho){
  const r = await fetch(`${SB}/rest/v1/${caminho}`, {
    headers: { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE }
  });
  if(!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
  return r.json();
}

export default async function handler(req, res){
  try{
    const u = new URL(req.url, 'http://x');
    const hoje = new Date();
    const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay()+6)%7) + 7);
    const dom = new Date(seg);  dom.setDate(seg.getDate() + 6);
    const iso = d => d.toISOString().slice(0,10);

    const de   = u.searchParams.get('de')   || iso(seg);
    const ate  = u.searchParams.get('ate')  || iso(dom);
    const marca = u.searchParams.get('marca');
    const filtroMarca = marca ? `&marca=eq.${encodeURIComponent(marca)}` : '';

    const cro = await busca(
      `planejamento_cronograma?select=*&dia=gte.${de}&dia=lte.${ate}${filtroMarca}` +
      `&order=dia.asc,campanha.asc,canal.asc`);
    const camps = await busca(`planejamento_campanhas?select=*${filtroMarca}&order=meta.desc`);

    res.setHeader('Cache-Control','public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin','*');
    if(u.searchParams.get('formato') === 'json'){
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.end(JSON.stringify({de, ate, marca: marca||'todas',
        campanhas: camps, cronograma: cro,
        tarefas: cro.map(l=>({nome: nomeDaTarefa(l), dia: l.dia,
          responsavel: l.quem_faz, campanha: l.campanha, marca: l.marca}))}, null, 2));
    }
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.end(emTexto(cro, camps, de, ate));
  }catch(e){
    res.statusCode = 502;
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.end('Não consegui ler o planejamento: ' + e.message);
  }
};
export { nomeDaTarefa, emTexto };
