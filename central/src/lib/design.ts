/** Peças de interface repetidas. Ficam aqui para a tela não virar um
 *  paredão de classes e para o visual não divergir de página em página. */

export const cartao =
  'rounded-[10px] border border-linha bg-papel';

export const campo =
  'w-full rounded-[8px] border border-linha bg-papel px-3 py-2 text-[14px] ' +
  'text-tinta placeholder:text-tinta-3 outline-none transition ' +
  'focus:border-linha-2 disabled:bg-papel-3 disabled:text-tinta-3';

export const rotulo =
  'block text-[11px] font-medium uppercase tracking-[0.08em] text-tinta-3';

export const botao =
  'inline-flex items-center justify-center gap-2 rounded-[8px] px-3.5 py-2 ' +
  'text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

export const botaoForte =
  botao + ' bg-tinta text-white hover:bg-tinta-2';

export const botaoLeve =
  botao + ' border border-linha bg-papel text-tinta hover:bg-papel-3';

export const aviso =
  'rounded-[8px] border border-linha bg-papel-3 px-3 py-2.5 text-[13px] text-tinta-2';

export const avisoErro =
  'rounded-[8px] border border-vermelho/25 bg-vermelho/5 px-3 py-2.5 text-[13px] text-vermelho';

/** Contraste do texto sobre a cor da marca, para o selo nunca sair
 *  ilegível quando alguém cadastrar uma marca clara. */
export function tintaSobre(cor: string): string {
  const hex = cor.replace('#', '');
  const n = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex.padEnd(6, '0');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  /* luminância relativa, na conta do WCAG */
  const lum = [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return L > 0.5 ? '#18181b' : '#ffffff';
}
