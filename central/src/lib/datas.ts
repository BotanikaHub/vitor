const FUSO = 'America/Sao_Paulo';

/** Hoje em São Paulo, no formato do banco. Usar a data do servidor sem
 *  fuso jogaria o "hoje" para o dia seguinte durante a noite. */
export function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
}

export function emDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA', { timeZone: FUSO });
}

/** Dia da semana em São Paulo: 0 domingo … 6 sábado. */
export function diaDaSemana(): number {
  const nome = new Date().toLocaleDateString('en-US', { timeZone: FUSO, weekday: 'short' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nome);
}

export const ehQuinta = () => diaDaSemana() === 4;

/** Quantos dias faltam para a próxima quinta — 0 se for hoje. */
export function ateQuinta(): number {
  return (4 - diaDaSemana() + 7) % 7;
}

export function dataCurta(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function porExtenso(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'long',
  });
}

export function saudacao(): string {
  const h = Number(new Date().toLocaleString('en-US', {
    timeZone: FUSO, hour: '2-digit', hour12: false,
  }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
