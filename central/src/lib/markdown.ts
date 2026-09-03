/** Markdown suficiente para o que a equipe escreve: título, negrito,
 *  lista, lista de caixinha, tabela, citação, código e link.
 *  Tudo passa por fuga antes de virar HTML — o texto vem de quem
 *  escreve o processo, e ninguém deve conseguir injetar marcação. */
const fuga = (t: string) =>
  String(t ?? '').replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]!));

function linha(t: string): string {
  return fuga(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, u) =>
      /^https?:\/\//.test(u)
        ? `<a href="${u}" target="_blank" rel="noopener">${txt}</a>`
        : txt);
}

export function md(cru: string): string {
  const L = String(cru ?? '').replace(/\r/g, '').split('\n');
  const fora: string[] = [];
  let i = 0;
  const celulas = (r: string) =>
    r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => linha(c.trim()));

  while (i < L.length) {
    const l = L[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    if (/^```/.test(l)) {
      const b: string[] = []; i++;
      while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]);
      i++; fora.push('<pre><code>' + fuga(b.join('\n')) + '</code></pre>'); continue;
    }
    if (/^#{1,6}\s/.test(l)) {
      const n = Math.min(l.match(/^#+/)![0].length + 1, 6);
      fora.push(`<h${n}>` + linha(l.replace(/^#+\s*/, '')) + `</h${n}>`); i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { fora.push('<hr>'); i++; continue; }
    if (l.includes('|') && i + 1 < L.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(L[i + 1])) {
      const cab = celulas(l); i += 2; const corpo: string[][] = [];
      while (i < L.length && L[i].includes('|') && !/^\s*$/.test(L[i])) corpo.push(celulas(L[i++]));
      fora.push('<div class="rolagem"><table><thead><tr>' +
        cab.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
        corpo.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>'); continue;
    }
    if (/^\s*>/.test(l)) {
      const b: string[] = [];
      while (i < L.length && /^\s*>/.test(L[i])) b.push(L[i++].replace(/^\s*>\s?/, ''));
      fora.push('<blockquote>' + linha(b.join(' ')) + '</blockquote>'); continue;
    }
    if (/^\s*[-*+]\s+/.test(l)) {
      const b: string[] = [];
      while (i < L.length && /^\s*[-*+]\s+/.test(L[i])) b.push(L[i++].replace(/^\s*[-*+]\s+/, ''));
      const caixa = b.every((x) => /^\[[ xX]\]\s?/.test(x));
      fora.push(caixa
        ? '<ul class="caixas">' + b.map((x) => {
            const feito = /^\[[xX]\]/.test(x);
            return `<li class="${feito ? 'ok' : ''}"><span class="cx">${feito ? '✓' : ''}</span>` +
              linha(x.replace(/^\[[ xX]\]\s?/, '')) + '</li>';
          }).join('') + '</ul>'
        : '<ul>' + b.map((x) => '<li>' + linha(x) + '</li>').join('') + '</ul>');
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const b: string[] = [];
      while (i < L.length && /^\s*\d+[.)]\s+/.test(L[i])) b.push(L[i++].replace(/^\s*\d+[.)]\s+/, ''));
      fora.push('<ol>' + b.map((x) => '<li>' + linha(x) + '</li>').join('') + '</ol>'); continue;
    }
    const p: string[] = [];
    while (i < L.length && !/^\s*$/.test(L[i]) && !L[i].includes('|') &&
           !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/.test(L[i])) p.push(L[i++]);
    /* linha que só o teste da tabela barrou: vai como parágrafo, e o
       laço anda — nenhuma linha some nem trava aqui */
    if (p.length) fora.push('<p>' + linha(p.join(' ')) + '</p>');
    else { fora.push('<p>' + linha(L[i]) + '</p>'); i++; }
  }
  return fora.join('');
}
