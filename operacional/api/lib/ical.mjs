/* ======================================================================
   Ler um calendário no formato iCalendar.

   Não é o formato inteiro — é o que um calendário de trabalho usa:
   eventos com hora ou de dia inteiro, repetição diária, semanal e
   mensal, exceções, e o caso em que uma ocorrência específica foi
   movida ou cancelada.

   Duas coisas que parecem detalhe e não são:

   1. O fuso. O Google escreve `DTSTART;TZID=America/Sao_Paulo:20260911T100000`
      — hora de parede, sem deslocamento. Somar zero transformaria a
      reunião das 10h em 7h para quem lê. A conversão aqui usa o próprio
      banco de fusos do runtime (Intl), então o horário de verão de
      qualquer país entra de graça e não há tabela para envelhecer.

   2. A repetição. A daily e a reunião de KPI são um evento só com
      RRULE; sem expandir, a agenda mostraria a daily uma vez em 2019 e
      mais nada.
   ====================================================================== */

/* ---------- desdobrar as linhas ----------
   O formato quebra linha em 75 bytes e continua com um espaço. Juntar
   antes de qualquer outra coisa, senão um SUMMARY longo vira duas
   propriedades, uma delas sem nome. */
export function linhas(texto) {
  const cru = String(texto || '').split(/\r\n|\n|\r/);
  const fora = [];
  for (const l of cru) {
    if ((l.startsWith(' ') || l.startsWith('\t')) && fora.length) fora[fora.length - 1] += l.slice(1);
    else fora.push(l);
  }
  return fora;
}

/* ---------- uma propriedade ----------
   NOME;PARAM=valor;OUTRO=x:conteúdo — e o conteúdo pode ter ":" dentro
   (uma URL, por exemplo), então corta no primeiro que estiver fora de
   aspas. */
export function propriedade(linha) {
  let i = 0, aspas = false;
  for (; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') aspas = !aspas;
    else if (c === ':' && !aspas) break;
  }
  if (i >= linha.length) return null;
  const cabeca = linha.slice(0, i);
  const valor = linha.slice(i + 1);
  /* também aqui as aspas mandam: um convidado chamado "Lage; Pedro"
     tem ponto e vírgula dentro do nome, e cortar nele partiria o
     parâmetro no meio */
  const partes = [];
  let atual = '', dentro = false;
  for (const c of cabeca) {
    if (c === '"') { dentro = !dentro; atual += c; continue }
    if (c === ';' && !dentro) { partes.push(atual); atual = ''; continue }
    atual += c;
  }
  partes.push(atual);
  const nome = partes[0].toUpperCase();
  const params = {};
  for (const p of partes.slice(1)) {
    const n = p.indexOf('=');
    if (n < 0) continue;
    params[p.slice(0, n).toUpperCase()] = p.slice(n + 1).replace(/^"|"$/g, '');
  }
  return { nome, params, valor };
}

const desescapar = (v) => String(v || '')
  .replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\');

/* ---------- hora de parede num fuso, em UTC ----------
   Chuta que a hora escrita é UTC, pergunta ao Intl que horas isso dá no
   fuso do evento, e corrige pela diferença. Uma correção basta em todo
   fuso real; a segunda volta existe para a hora que cai dentro do pulo
   do horário de verão. */
const CAMPOS = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };

function noFuso(ms, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hour12: false, ...CAMPOS })
    .formatToParts(new Date(ms));
  const v = {};
  for (const x of p) if (x.type !== 'literal') v[x.type] = +x.value;
  return Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second);
}

export function paredeParaUTC(a, m, d, hh, mm, ss, fuso) {
  let chute = Date.UTC(a, m - 1, d, hh, mm, ss);
  if (!fuso) return chute;
  try {
    for (let i = 0; i < 2; i++) chute += Date.UTC(a, m - 1, d, hh, mm, ss) - noFuso(chute, fuso);
  } catch { /* fuso que o runtime não conhece: fica como está */ }
  return chute;
}

/* ---------- uma data do iCal ---------- */
export function data(valor, params) {
  const v = String(valor || '').trim();
  const soDia = (params && params.VALUE === 'DATE') || /^\d{8}$/.test(v);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, a, mes, d, hh, mm, ss, z] = m;
  if (soDia) {
    return { diaInteiro: true, ms: Date.UTC(+a, +mes - 1, +d), dia: `${a}-${mes}-${d}` };
  }
  const ms = z
    ? Date.UTC(+a, +mes - 1, +d, +hh, +mm, +ss)
    : paredeParaUTC(+a, +mes, +d, +hh, +mm, +ss, params && params.TZID);
  return { diaInteiro: false, ms };
}

/* ---------- quebrar em blocos VEVENT ---------- */
export function eventosCrus(texto) {
  const fora = [];
  let atual = null;
  for (const l of linhas(texto)) {
    const p = propriedade(l);
    if (!p) continue;
    if (p.nome === 'BEGIN' && p.valor === 'VEVENT') { atual = { props: [] }; continue }
    if (p.nome === 'END' && p.valor === 'VEVENT') { if (atual) fora.push(atual); atual = null; continue }
    if (atual) atual.props.push(p);
  }
  return fora;
}

const DIAS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function lerRRule(v) {
  const r = {};
  for (const p of String(v || '').split(';')) {
    const n = p.indexOf('=');
    if (n < 0) continue;
    r[p.slice(0, n).toUpperCase()] = p.slice(n + 1);
  }
  return {
    freq: String(r.FREQ || '').toUpperCase(),
    intervalo: Math.max(1, +(r.INTERVAL || 1) || 1),
    dias: r.BYDAY ? String(r.BYDAY).split(',').map((d) => DIAS[d.slice(-2).toUpperCase()]).filter((d) => d != null) : null,
    ate: r.UNTIL ? (data(r.UNTIL, {}) || {}).ms : null,
    quantas: r.COUNT ? +r.COUNT : null,
  };
}

/* ---------- expandir a repetição dentro de uma janela ----------
   Anda de ocorrência em ocorrência somando o intervalo. O teto de mil
   passos é o que impede um RRULE sem fim e sem UNTIL de virar laço. */
function repetir(inicio, regra, de, ate) {
  const fora = [];
  if (!regra.freq) return [inicio];
  const passo = (ms, n) => {
    const d = new Date(ms);
    if (regra.freq === 'DAILY') d.setUTCDate(d.getUTCDate() + n);
    else if (regra.freq === 'WEEKLY') d.setUTCDate(d.getUTCDate() + n * 7);
    else if (regra.freq === 'MONTHLY') {
      const dia = d.getUTCDate();
      d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
      const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(dia, ultimo));
    } else if (regra.freq === 'YEARLY') d.setUTCFullYear(d.getUTCFullYear() + n);
    else return null;
    return d.getTime();
  };

  let ms = inicio, n = 0;
  for (let i = 0; i < 1000 && ms != null; i++) {
    if (regra.ate && ms > regra.ate) break;
    if (regra.quantas && n >= regra.quantas) break;

    if (regra.freq === 'WEEKLY' && regra.dias && regra.dias.length) {
      /* a semana inteira de uma vez: MO,WE,FR são três ocorrências da
         mesma semana, e não três semanas */
      const base = new Date(ms);
      const segunda = base.getTime() - ((base.getUTCDay() + 6) % 7) * 86400000;
      for (const d of regra.dias) {
        const q = segunda + ((d + 6) % 7) * 86400000;
        if (q < inicio) continue;
        if (regra.ate && q > regra.ate) continue;
        if (q >= de && q <= ate) fora.push(q);
        n++;
        if (regra.quantas && n >= regra.quantas) break;
      }
    } else {
      if (ms >= de && ms <= ate) fora.push(ms);
      n++;
    }
    if (ms > ate) break;
    ms = passo(ms, regra.intervalo);
  }
  return fora;
}

const soDia = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ======================================================================
   A leitura inteira: texto do calendário → lista de compromissos
   ====================================================================== */
export function ler(texto, { de, ate, limite = 400 } = {}) {
  const inicio = de instanceof Date ? de.getTime() : +de;
  const fim = ate instanceof Date ? ate.getTime() : +ate;

  const crus = eventosCrus(texto);
  const fora = [];
  /* uma ocorrência que foi movida ou cancelada vem como um VEVENT à
     parte, com RECURRENCE-ID apontando para a data original */
  const trocados = new Map();

  for (const ev of crus) {
    const get = (n) => (ev.props.find((p) => p.nome === n) || null);
    const rec = get('RECURRENCE-ID');
    if (!rec) continue;
    const uid = (get('UID') || {}).valor || '';
    const d = data(rec.valor, rec.params);
    if (d) trocados.set(`${uid}|${soDia(d.ms)}`, ev);
  }

  for (const ev of crus) {
    const get = (n) => (ev.props.find((p) => p.nome === n) || null);
    const dtstart = get('DTSTART');
    if (!dtstart) continue;
    const ini = data(dtstart.valor, dtstart.params);
    if (!ini) continue;

    const uid = (get('UID') || {}).valor || '';
    const status = String((get('STATUS') || {}).valor || '').toUpperCase();
    if (status === 'CANCELLED') continue;

    const dtend = get('DTEND');
    const fimEv = dtend ? data(dtend.valor, dtend.params) : null;
    const dura = fimEv ? Math.max(0, fimEv.ms - ini.ms) : (ini.diaInteiro ? 86400000 : 3600000);

    const rrule = get('RRULE');
    const rec = get('RECURRENCE-ID');

    /* datas tiradas da série */
    const fora_ = new Set();
    for (const p of ev.props) {
      if (p.nome !== 'EXDATE') continue;
      for (const v of String(p.valor).split(',')) {
        const d = data(v.trim(), p.params);
        if (d) fora_.add(soDia(d.ms));
      }
    }

    const quandos = rec
      ? [ini.ms]                                    /* é a ocorrência trocada */
      : rrule
        ? repetir(ini.ms, lerRRule(rrule.valor), inicio, fim)
        : (ini.ms + dura >= inicio && ini.ms <= fim ? [ini.ms] : []);

    for (const ms of quandos) {
      const dia = soDia(ms);
      if (fora_.has(dia)) continue;
      /* se esta data virou um evento à parte, quem manda é o à parte */
      if (!rec && trocados.has(`${uid}|${dia}`)) continue;

      fora.push({
        uid: rec ? `${uid}@${dia}` : (rrule ? `${uid}@${dia}` : uid),
        titulo: desescapar((get('SUMMARY') || {}).valor) || '(sem título)',
        onde: desescapar((get('LOCATION') || {}).valor) || '',
        sobre: desescapar((get('DESCRIPTION') || {}).valor).slice(0, 1200),
        link: (get('URL') || {}).valor || '',
        diaInteiro: !!ini.diaInteiro,
        comeca: new Date(ms).toISOString(),
        termina: new Date(ms + dura).toISOString(),
        gente: ev.props.filter((p) => p.nome === 'ATTENDEE').length,
      });
      if (fora.length >= limite) break;
    }
    if (fora.length >= limite) break;
  }

  fora.sort((a, b) => a.comeca.localeCompare(b.comeca));
  return fora;
}
