/* Ler o calendário de quem ligou o dele.

   O que precisa valer: a linha quebrada em 75 bytes volta inteira; a
   reunião marcada num fuso chega na hora certa, com e sem horário de
   verão; a daily, que é um evento só com regra de repetição, aparece
   todo dia; a que foi cancelada não aparece; a que foi movida aparece no
   lugar novo e não no velho; e nada disso entra em laço quando a regra
   não tem fim. */
import assert from 'node:assert/strict';
import { ler, linhas, propriedade, data, paredeParaUTC } from '../api/lib/ical.mjs';

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

const cal = (corpo) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${corpo}\r\nEND:VCALENDAR\r\n`;
const janela = { de: Date.UTC(2026, 8, 1), ate: Date.UTC(2026, 9, 15) };
const hora = (iso, fuso) => new Intl.DateTimeFormat('pt-BR', { timeZone: fuso || 'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(iso));

/* ---------- 1. a forma do arquivo ---------- */
console.log('\na forma do arquivo');
conf('a linha quebrada em 75 bytes volta inteira',
  linhas('SUMMARY:Reunião de KPI da\r\n  semana').join('|') === 'SUMMARY:Reunião de KPI da semana');
conf('o nome e os parâmetros saem separados do conteúdo', (() => {
  const p = propriedade('DTSTART;TZID=America/Sao_Paulo:20260911T100000');
  return p.nome === 'DTSTART' && p.params.TZID === 'America/Sao_Paulo' && p.valor === '20260911T100000';
})());
conf('dois-pontos dentro do conteúdo não corta a propriedade',
  propriedade('URL:https://meet.google.com/abc-defg').valor === 'https://meet.google.com/abc-defg');
conf('parâmetro entre aspas com ponto e vírgula dentro não confunde',
  propriedade('ATTENDEE;CN="Lage; Pedro":mailto:p@b.com').params.CN === 'Lage; Pedro');

/* ---------- 2. o fuso ---------- */
console.log('\no fuso');
conf('10h de São Paulo é 13h em UTC, no horário normal',
  paredeParaUTC(2026, 9, 11, 10, 0, 0, 'America/Sao_Paulo') === Date.UTC(2026, 8, 11, 13, 0, 0));
conf('e a marcada em UTC fica onde está',
  data('20260911T130000Z', {}).ms === Date.UTC(2026, 8, 11, 13, 0, 0));
conf('a de outro fuso também chega certa',
  paredeParaUTC(2026, 9, 11, 10, 0, 0, 'Europe/Lisbon') === Date.UTC(2026, 8, 11, 9, 0, 0));
conf('um fuso que o runtime não conhece não derruba a leitura',
  paredeParaUTC(2026, 9, 11, 10, 0, 0, 'Nenhum/Lugar') === Date.UTC(2026, 8, 11, 10, 0, 0));
conf('evento de dia inteiro não ganha hora', data('20260911', { VALUE: 'DATE' }).diaInteiro === true);

/* ---------- 3. um evento simples ---------- */
console.log('\num evento');
const um = ler(cal(
`BEGIN:VEVENT\r
UID:abc-1\r
SUMMARY:Reunião de KPI\r
LOCATION:Meet\r
DESCRIPTION:Levar os números da\\nsemana\r
DTSTART;TZID=America/Sao_Paulo:20260910T100000\r
DTEND;TZID=America/Sao_Paulo:20260910T110000\r
ATTENDEE;CN=Pedro:mailto:p@b.com\r
ATTENDEE;CN=Sarah:mailto:s@b.com\r
END:VEVENT`), janela);
conf('o evento é lido', um.length === 1);
conf('com o título', um[0].titulo === 'Reunião de KPI');
conf('com a hora de São Paulo, e não três horas antes', hora(um[0].comeca) === '10:00');
conf('e com a hora de terminar', hora(um[0].termina) === '11:00');
conf('o local vem junto', um[0].onde === 'Meet');
conf('a quebra de linha da descrição volta a ser quebra de linha', um[0].sobre.includes('da\nsemana'));
conf('e quantas pessoas estão convidadas', um[0].gente === 2);

/* ---------- 4. a repetição ---------- */
console.log('\na repetição');
const daily = ler(cal(
`BEGIN:VEVENT\r
UID:daily\r
SUMMARY:Daily da operação\r
DTSTART;TZID=America/Sao_Paulo:20260907T090000\r
DTEND;TZID=America/Sao_Paulo:20260907T091500\r
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r
END:VEVENT`), { de: Date.UTC(2026, 8, 7), ate: Date.UTC(2026, 8, 13, 23, 59) });
conf('a daily de segunda a sexta aparece cinco vezes na semana', daily.length === 5);
conf('e não no sábado nem no domingo', daily.every((e) => ![0, 6].includes(new Date(e.comeca).getUTCDay())));
conf('cada dia com hora certa', daily.every((e) => hora(e.comeca) === '09:00'));
conf('e com identidade própria por dia, para a anotação não se misturar',
  new Set(daily.map((e) => e.uid)).size === 5);

const semanal = ler(cal(
`BEGIN:VEVENT\r
UID:kpi\r
SUMMARY:KPI\r
DTSTART;TZID=America/Sao_Paulo:20260903T140000\r
DTEND;TZID=America/Sao_Paulo:20260903T150000\r
RRULE:FREQ=WEEKLY;BYDAY=TH;UNTIL=20260925T000000Z\r
END:VEVENT`), janela);
conf('a semanal de quinta vem toda quinta', semanal.every((e) => new Date(e.comeca).getUTCDay() === 4));
conf('e para no dia combinado', semanal.every((e) => e.comeca <= '2026-09-25') && semanal.length === 4);

const mensal = ler(cal(
`BEGIN:VEVENT\r
UID:fecha\r
SUMMARY:Fechamento do mês\r
DTSTART;TZID=America/Sao_Paulo:20260831T160000\r
DTEND;TZID=America/Sao_Paulo:20260831T170000\r
RRULE:FREQ=MONTHLY\r
END:VEVENT`), { de: Date.UTC(2026, 8, 1), ate: Date.UTC(2027, 0, 5) });
conf('a mensal do dia 31 cai no último dia dos meses curtos',
  mensal.map((e) => e.comeca.slice(0, 10)).includes('2026-09-30'));

const semFim = ler(cal(
`BEGIN:VEVENT\r
UID:sem-fim\r
SUMMARY:Sem fim\r
DTSTART;TZID=America/Sao_Paulo:20200101T080000\r
DTEND;TZID=America/Sao_Paulo:20200101T083000\r
RRULE:FREQ=DAILY\r
END:VEVENT`), { de: Date.UTC(2026, 8, 1), ate: Date.UTC(2026, 8, 8) });
conf('regra sem fim não trava a leitura, e devolve só a janela pedida', semFim.length <= 8);

/* ---------- 5. o que foi tirado e o que foi movido ---------- */
console.log('\nexceções');
const comEx = ler(cal(
`BEGIN:VEVENT\r
UID:daily2\r
SUMMARY:Daily\r
DTSTART;TZID=America/Sao_Paulo:20260907T090000\r
DTEND;TZID=America/Sao_Paulo:20260907T091500\r
RRULE:FREQ=DAILY\r
EXDATE;TZID=America/Sao_Paulo:20260909T090000\r
END:VEVENT`), { de: Date.UTC(2026, 8, 7), ate: Date.UTC(2026, 8, 11, 23, 59) });
conf('o dia cancelado não aparece', !comEx.some((e) => e.comeca.slice(0, 10) === '2026-09-09'));
conf('e os outros continuam', comEx.length === 4);

const movido = ler(cal(
`BEGIN:VEVENT\r
UID:daily3\r
SUMMARY:Daily\r
DTSTART;TZID=America/Sao_Paulo:20260907T090000\r
DTEND;TZID=America/Sao_Paulo:20260907T091500\r
RRULE:FREQ=DAILY\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:daily3\r
RECURRENCE-ID;TZID=America/Sao_Paulo:20260908T090000\r
SUMMARY:Daily (mais tarde)\r
DTSTART;TZID=America/Sao_Paulo:20260908T113000\r
DTEND;TZID=America/Sao_Paulo:20260908T114500\r
END:VEVENT`), { de: Date.UTC(2026, 8, 7), ate: Date.UTC(2026, 8, 9, 23, 59) });
const dia8 = movido.filter((e) => e.comeca.slice(0, 10) === '2026-09-08');
conf('o dia que foi movido aparece uma vez só', dia8.length === 1);
conf('e na hora nova', hora(dia8[0].comeca) === '11:30');
conf('com o título novo', dia8[0].titulo === 'Daily (mais tarde)');

const cancelado = ler(cal(
`BEGIN:VEVENT\r
UID:x\r
SUMMARY:Que não vai ter\r
STATUS:CANCELLED\r
DTSTART;TZID=America/Sao_Paulo:20260910T100000\r
DTEND;TZID=America/Sao_Paulo:20260910T110000\r
END:VEVENT`), janela);
conf('evento cancelado não entra na agenda', cancelado.length === 0);

/* ---------- 6. a janela e a ordem ---------- */
console.log('\na janela');
const fora = ler(cal(
`BEGIN:VEVENT\r
UID:velho\r
SUMMARY:Coisa de julho\r
DTSTART;TZID=America/Sao_Paulo:20260705T100000\r
DTEND;TZID=America/Sao_Paulo:20260705T110000\r
END:VEVENT`), janela);
conf('o que está fora da janela não vem', fora.length === 0);

const ordem = ler(cal(
`BEGIN:VEVENT\r
UID:b\r
SUMMARY:Depois\r
DTSTART;TZID=America/Sao_Paulo:20260910T160000\r
DTEND;TZID=America/Sao_Paulo:20260910T170000\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:a\r
SUMMARY:Antes\r
DTSTART;TZID=America/Sao_Paulo:20260910T080000\r
DTEND;TZID=America/Sao_Paulo:20260910T090000\r
END:VEVENT`), janela);
conf('a agenda sai em ordem de hora', ordem[0].titulo === 'Antes');

const inteiro = ler(cal(
`BEGIN:VEVENT\r
UID:feriado\r
SUMMARY:Feriado\r
DTSTART;VALUE=DATE:20260907\r
DTEND;VALUE=DATE:20260908\r
END:VEVENT`), janela);
conf('o evento de dia inteiro é marcado como tal', inteiro[0] && inteiro[0].diaInteiro === true);

conf('arquivo vazio não quebra nada', ler('', janela).length === 0);
conf('lixo no lugar do calendário também não', ler('não é um calendário', janela).length === 0);

console.log(`\nical: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
