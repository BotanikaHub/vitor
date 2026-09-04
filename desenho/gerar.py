# -*- coding: utf-8 -*-
"""Gera os artboards da Central. A casca é a mesma em todos — cada
   arquivo é independente, então ela é escrita uma vez aqui e repetida."""
import io, os

BOT, VER = '#14713D', '#1D4ED8'

CSS = """
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'IBM Plex Sans',system-ui,sans-serif;background:#FBFBFA;color:#1C1917;
       font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}
  a{color:#1C1917;text-decoration:none}
  a:hover{color:#57534E}
  .num{font-family:'IBM Plex Mono','SF Mono',monospace;font-variant-numeric:tabular-nums}
  .app{display:grid;grid-template-columns:224px 1fr;height:900px;overflow:hidden}
  /* ---- barra lateral: a marca manda, e o resto vive dentro dela ---- */
  .lado{background:#F5F5F4;border-right:1px solid #E7E5E4;display:flex;flex-direction:column;overflow:hidden}
  .marca{padding:14px 14px 12px;border-bottom:1px solid #E7E5E4}
  .marca-cx{display:flex;align-items:center;gap:9px;padding:7px 9px;background:#fff;
            border:1px solid #E7E5E4;border-radius:6px;cursor:pointer}
  .marca-pt{width:9px;height:9px;border-radius:2px;flex:none}
  .marca-nm{font-weight:600;font-size:13px;letter-spacing:-.01em;flex:1}
  .marca-sub{font-size:10.5px;color:#A8A29E;margin-top:5px;padding-left:2px;letter-spacing:.01em}
  .nav{padding:10px 8px;overflow-y:auto;flex:1}
  .nav-t{font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
         color:#A8A29E;padding:12px 8px 5px}
  .nav-i{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:5px;
         color:#44403C;font-size:12.5px;cursor:pointer}
  .nav-i:hover{background:#EBEAE8}
  .nav-i.on{background:#fff;color:#1C1917;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.05)}
  .nav-i svg{flex:none;color:#78716C}
  .nav-i.on svg{color:#1C1917}
  .nav-b{margin-left:auto;font-size:10.5px;color:#A8A29E;font-family:'IBM Plex Mono',monospace}
  .nav-b.mal{color:#B91C1C;font-weight:600}
  .eu{border-top:1px solid #E7E5E4;padding:10px 12px;display:flex;align-items:center;gap:9px}
  .av{width:26px;height:26px;border-radius:50%;background:#E7E5E4;display:flex;align-items:center;
      justify-content:center;font-size:10px;font-weight:600;color:#57534E;flex:none}
  /* ---- conteúdo ---- */
  .corpo{overflow:hidden;display:flex;flex-direction:column}
  .topo{border-bottom:1px solid #E7E5E4;background:#fff;padding:13px 22px;display:flex;
        align-items:center;gap:14px}
  .topo h1{font-size:16px;font-weight:600;letter-spacing:-.015em}
  .topo .sub{font-size:11.5px;color:#78716C}
  .dir{margin-left:auto;display:flex;align-items:center;gap:7px}
  .bt{border:1px solid #E7E5E4;background:#fff;border-radius:5px;padding:5px 10px;font-size:12px;
      font-family:inherit;color:#44403C;cursor:pointer}
  .bt.forte{background:#1C1917;border-color:#1C1917;color:#fff;font-weight:500}
  .pg{padding:18px 22px;overflow-y:auto;flex:1}
  /* ---- peças ---- */
  .cx{background:#fff;border:1px solid #E7E5E4;border-radius:6px}
  .cx-t{padding:9px 13px;border-bottom:1px solid #E7E5E4;display:flex;align-items:center;gap:9px}
  .cx-t h2{font-size:12px;font-weight:600;letter-spacing:-.005em}
  .cx-t .mais{margin-left:auto;font-size:11px;color:#A8A29E}
  .rot{font-size:9.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#A8A29E}
  .g{display:grid;gap:12px}
  table{width:100%;border-collapse:collapse}
  th{font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#A8A29E;
     text-align:left;padding:7px 13px;border-bottom:1px solid #E7E5E4;background:#FCFCFB}
  td{padding:8px 13px;border-bottom:1px solid #F5F5F4;font-size:12.5px;vertical-align:middle}
  tr:last-child td{border-bottom:0}
  th.d,td.d{text-align:right}
  .selo{display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:3px;
        font-size:10.5px;font-weight:500;line-height:1.5}
  .pt{width:6px;height:6px;border-radius:50%;flex:none}
  .barra{height:5px;background:#F0EFED;border-radius:3px;overflow:hidden;display:flex}
  .barra i{display:block;height:100%}
  .mal{color:#B91C1C}.bom{color:#15803D}.ate{color:#B45309}
"""

def ico(d):
    return ('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>')

I = {
 'casa': ico('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
 'grafico': ico('<path d="M3 21h18"/><rect x="5" y="11" width="3.5" height="7"/><rect x="10.5" y="6" width="3.5" height="12"/><rect x="16" y="14" width="3.5" height="4"/>'),
 'foguete': ico('<path d="M5 15c-1 2-1 5-1 5s3 0 5-1"/><path d="M9 14 6.5 11.5C6.5 6 11 3 16 3c2.5 0 5 0 5 0s0 2.5 0 5c0 5-3 9.5-8.5 9.5L10 15"/><circle cx="15" cy="9" r="1.6"/>'),
 'lista': ico('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
 'cal': ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
 'chat': ico('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/>'),
 'gente': ico('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 11.5a3 3 0 0 0 0-6"/><path d="M18 20c0-2.4-.9-4.2-2.4-5.2"/>'),
 'livro': ico('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>'),
 'chave': ico('<path d="M14.5 7.5a4.5 4.5 0 1 0-4.2 6L9 15H7v2H5v2H2v-3l6-6a4.5 4.5 0 0 1 6.5-2.5Z"/><circle cx="16.5" cy="6.5" r="1"/>'),
 'time': ico('<circle cx="12" cy="7" r="3.4"/><path d="M4.5 20c0-3.6 3.4-6.2 7.5-6.2s7.5 2.6 7.5 6.2"/>'),
}

def nav(ativo, contagens):
    def item(k, nome, chave, badge=''):
        on = ' on' if chave == ativo else ''
        b = f'<span class="nav-b{" mal" if badge.startswith("!") else ""}">{badge.lstrip("!")}</span>' if badge else ''
        return f'<div class="nav-i{on}">{I[k]}<span>{nome}</span>{b}</div>'
    c = contagens
    return f'''
      <div class="nav-t">Todo dia</div>
      {item('casa','Início','inicio')}
      {item('lista','Tarefas','tarefas', c.get('tarefas',''))}
      {item('cal','Conteúdo','conteudo', c.get('conteudo',''))}
      {item('chat','Atendimento','atendimento', c.get('atendimento',''))}
      <div class="nav-t">O mês</div>
      {item('grafico','Resultado','resultado')}
      {item('foguete','Campanhas','campanhas', c.get('campanhas',''))}
      {item('gente','Creators','creators', c.get('creators',''))}
      <div class="nav-t">A casa</div>
      {item('livro','Processos','processos')}
      {item('chave','Ferramentas','ferramentas')}
      {item('time','Equipe','equipe')}
    '''

def pagina(arquivo, titulo, sub, ativo, conteudo, direita='', marca='Botanika',
           cor=BOT, marca_sub='Suplementação · 11 produtos · ticket R$ 340',
           contagens=None):
    contagens = contagens or {'tarefas': '!9', 'conteudo': '4', 'atendimento': '!12',
                              'campanhas': '3', 'creators': '2'}
    html = f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet><style>{CSS}</style></helmet>
<div class="app">
  <aside class="lado">
    <div class="marca">
      <div class="marca-cx">
        <span class="marca-pt" style="background:{cor}"></span>
        <span class="marca-nm">{marca}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="m7 9 5-5 5 5"/><path d="m7 15 5 5 5-5"/></svg>
      </div>
      <div class="marca-sub">{marca_sub}</div>
    </div>
    <nav class="nav">{nav(ativo, contagens)}</nav>
    <div class="eu">
      <span class="av">VG</span>
      <div style="min-width:0;flex:1">
        <div style="font-size:12px;font-weight:500">Vitor Gutierrez</div>
        <div style="font-size:10.5px;color:#A8A29E">Gestão de projetos</div>
      </div>
    </div>
  </aside>
  <div class="corpo">
    <header class="topo">
      <div>
        <h1>{titulo}</h1>
        <div class="sub">{sub}</div>
      </div>
      <div class="dir">{direita}</div>
    </header>
    <div class="pg">{conteudo}</div>
  </div>
</div>
</x-dc>
</body>
</html>'''
    io.open(arquivo, 'w', encoding='utf-8').write(html)
    return arquivo
