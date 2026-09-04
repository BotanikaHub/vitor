# -*- coding: utf-8 -*-
from gerar import pagina, BOT, VER

# =============================== CREATORS ==================================
creators = '''
<div class="g" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
  <div class="cx" style="padding:11px 13px"><div class="rot">Creators ativos</div>
    <div class="num" style="font-size:22px;font-weight:600;margin-top:3px">7</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">2 entram este mês</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Entregas atrasadas</div>
    <div class="num mal" style="font-size:22px;font-weight:600;margin-top:3px">3</div>
    <div style="font-size:11px;color:#B91C1C;margin-top:2px">a mais antiga há 12 dias</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Sem autorização de imagem</div>
    <div class="num ate" style="font-size:22px;font-weight:600;margin-top:3px">4</div>
    <div style="font-size:11px;color:#B45309;margin-top:2px">bloqueia anunciar em collab</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Faturado por creators</div>
    <div class="num" style="font-size:22px;font-weight:600;margin-top:3px">R$ 33.600</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">28% da meta do canal</div></div>
</div>

<div class="cx" style="margin-bottom:12px">
  <div class="cx-t"><h2>Quem é, o que combinou, o que entregou</h2>
    <span class="mais">7 ativos</span></div>
  <table>
    <tr><th style="width:19%">Creator</th><th>Combinado</th><th style="width:150px">Entregas</th>
        <th class="d">Custo</th><th class="d">Rendeu</th><th class="d">Imagem</th><th>Próxima</th></tr>
    <tr><td><b style="font-weight:600">Grazi</b>
            <div style="font-size:10.5px;color:#A8A29E">sócia · farmacêutica há 20 anos</div></td>
        <td style="color:#57534E">3 ganchos, 3 desenvolvimentos e 2 CTAs por protocolo</td>
        <td><div class="barra"><i style="width:75%;background:#14713D"></i></div>
            <div style="font-size:10.5px;color:#78716C;margin-top:3px">6 de 8</div></td>
        <td class="d num">—</td><td class="d num bom">14.200</td>
        <td class="d"><span class="selo bom" style="background:#F0FDF4">ok</span></td>
        <td class="num">08/09</td></tr>
    <tr><td><b style="font-weight:600">Larissa</b>
            <div style="font-size:10.5px;color:#A8A29E">lives · duas por dia</div></td>
        <td style="color:#57534E">2 lives diárias, uma por marca</td>
        <td><div class="barra"><i style="width:100%;background:#14713D"></i></div>
            <div style="font-size:10.5px;color:#78716C;margin-top:3px">14 de 14</div></td>
        <td class="d num">2.800</td><td class="d num">—</td>
        <td class="d"><span class="selo bom" style="background:#F0FDF4">ok</span></td>
        <td class="num">hoje 19h</td></tr>
    <tr><td><b style="font-weight:600">Júlia Colares</b>
            <div style="font-size:10.5px;color:#A8A29E">comissão de 15%</div></td>
        <td style="color:#57534E">Posts em collab, comissão sobre venda</td>
        <td><div class="barra"><i style="width:50%;background:#B45309"></i><i style="width:50%;background:#D6D3D1"></i></div>
            <div style="font-size:10.5px;color:#78716C;margin-top:3px">2 de 4</div></td>
        <td class="d num">15%</td><td class="d num bom">9.400</td>
        <td class="d"><span class="selo ate" style="background:#FFFBEB">falta</span></td>
        <td class="num">—</td></tr>
    <tr><td><b style="font-weight:600">Vitória</b>
            <div style="font-size:10.5px;color:#A8A29E">contato pelo Gabriel</div></td>
        <td style="color:#57534E">Roteiros com o Ítalo, ainda a combinar</td>
        <td><div class="barra"><i style="width:0%;background:#D6D3D1"></i></div>
            <div style="font-size:10.5px;color:#78716C;margin-top:3px">0 de 3 · roteiro pendente</div></td>
        <td class="d num" style="color:#A8A29E">—</td><td class="d num" style="color:#A8A29E">—</td>
        <td class="d"><span class="selo ate" style="background:#FFFBEB">falta</span></td>
        <td class="num" style="color:#A8A29E">—</td></tr>
    <tr><td><b style="font-weight:600">Paula</b>
            <div style="font-size:10.5px;color:#A8A29E">começa dia 11</div></td>
        <td style="color:#57534E">UGC · 4 vídeos no formato pergunta-e-resposta</td>
        <td><div class="barra"><i style="width:0%;background:#D6D3D1"></i></div>
            <div style="font-size:10.5px;color:#78716C;margin-top:3px">não começou</div></td>
        <td class="d num">1.200</td><td class="d num" style="color:#A8A29E">—</td>
        <td class="d"><span class="selo bom" style="background:#F0FDF4">ok</span></td>
        <td class="num">11/09</td></tr>
    <tr><td><b style="font-weight:600">Polyana</b>
            <div style="font-size:10.5px;color:#A8A29E">depoimento · "sou uma péssima mãe"</div></td>
        <td style="color:#57534E">Material bruto para o Ítalo editar</td>
        <td><div class="barra"><i style="width:0%;background:#B91C1C"></i><i style="width:100%;background:#D6D3D1"></i></div>
            <div style="font-size:10.5px;color:#B91C1C;margin-top:3px">venceu 04/09</div></td>
        <td class="d num">—</td><td class="d num" style="color:#A8A29E">—</td>
        <td class="d"><span class="selo bom" style="background:#F0FDF4">ok</span></td>
        <td class="num mal">atrasada</td></tr>
  </table>
</div>

<div class="g" style="grid-template-columns:1fr 1fr">
  <div class="cx">
    <div class="cx-t"><h2>Collabs esperando autorização</h2>
      <span class="mais">sem ela não dá pra anunciar plugando o perfil</span></div>
    <table>
      <tr><th>Post</th><th>Creator</th><th class="d">Desempenho</th><th class="d">Pedido em</th></tr>
      <tr><td>Opinião do doutor · viralizou</td><td>Dr. Willian</td>
          <td class="d num bom">42 mil views</td><td class="d num ate">há 8 dias</td></tr>
      <tr><td>Collab espontânea</td><td>Júlia Colares</td>
          <td class="d num">11 mil views</td><td class="d num ate">há 5 dias</td></tr>
      <tr><td>Corte da live</td><td>Grazi</td>
          <td class="d num">26 mil views</td><td class="d num">—</td></tr>
    </table>
    <div style="padding:9px 13px;border-top:1px solid #F5F5F4;font-size:11px;color:#78716C">
      Ana pediu a lista ao Ítalo em 03/09. Novos contratos já saem com o termo.
    </div>
  </div>
  <div class="cx">
    <div class="cx-t"><h2>O que rendeu por creator · 7 dias</h2></div>
    <table>
      <tr><th>Creator</th><th style="width:110px">Participação</th>
          <th class="d">Vendas</th><th class="d">Faturado</th></tr>
      <tr><td>Grazi</td><td><div class="barra"><i style="width:60%;background:#14713D"></i></div></td>
          <td class="d num">16</td><td class="d num">7.120</td></tr>
      <tr><td>Júlia Colares</td><td><div class="barra"><i style="width:32%;background:#2563EB"></i></div></td>
          <td class="d num">8</td><td class="d num">3.760</td></tr>
      <tr><td>Dr. Willian</td><td><div class="barra"><i style="width:14%;background:#7C3AED"></i></div></td>
          <td class="d num">4</td><td class="d num">1.550</td></tr>
    </table>
  </div>
</div>
'''
pagina('Creators.dc.html', 'Creators', 'Botanika · quem é, o que combinou, o que entregou e quanto rendeu',
       'creators', creators,
       direita='<button class="bt">Ativos</button><button class="bt forte">+ Creator</button>')

# ======================= TAREFAS (a marca VermeFree, pra mostrar a troca) ===
tarefas = '''
<div style="display:flex;gap:7px;align-items:center;margin-bottom:12px">
  <div style="display:flex;border:1px solid #E7E5E4;border-radius:5px;background:#fff;padding:2px">
    <span style="padding:4px 10px;border-radius:3px;background:#F5F5F4;font-weight:600;font-size:12px">Quadro</span>
    <span style="padding:4px 10px;font-size:12px;color:#57534E">Por campanha</span>
    <span style="padding:4px 10px;font-size:12px;color:#57534E">Por pessoa</span>
    <span style="padding:4px 10px;font-size:12px;color:#57534E">Semana</span>
  </div>
  <span class="bt">Todo mundo</span>
  <span class="bt">Todas as campanhas</span>
  <span class="bt" style="border-style:dashed;color:#78716C">+ filtro</span>
  <span style="margin-left:auto;font-size:11.5px;color:#78716C">46 abertas · <span class="mal" style="font-weight:600">9 vencidas</span></span>
</div>

<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
'''
COLS = [
 ('a fazer','#78716C',40,[
   ('DIA D KIDS','Configurar o desconto e o frete na Shopify','24/09','Pedro Lage','alta','#B45309',None,False),
   ('DIA D KIDS','Criar toda a copy','24/09','Pedro · Ítalo','urgente','#B91C1C',(1,4),False),
   ('AÇÕES DE RECOMPRA','WhatsApp API','14/08','Sarah','urgente','#B91C1C',None,True),
   ('AVULSAS','Levantar status e entregas das UGCs','28/08','Ana Medeiros','normal','#0891B2',None,True),
 ]),
 ('fazendo','#7C3AED',1,[
   ('DIA D KIDS','Programar todos os disparos','25/09','Sarah','alta','#B45309',(0,3),False),
 ]),
 ('revisar','#B45309',0,[]),
 ('ajustes necessários','#C2410C',0,[]),
 ('feito','#15803D',61,[
   ('DIA D','Criar 4 a 5 criativos em vídeo','03/09','Ítalo Neves','urgente','#B91C1C',None,False),
 ]),
]
def cartao(proj, nome, dia, quem, prio, cor, chk, atrasada):
    borda = 'border-left:2px solid #B91C1C;' if atrasada else ''
    itens = ''
    if chk:
        feitos, total = chk
        linhas = []
        for i in range(min(3, total)):
            ok = i < feitos
            linhas.append(
              f'''<div style="display:flex;gap:5px;align-items:flex-start;font-size:11px;
                  color:{'#A8A29E' if ok else '#57534E'};{'text-decoration:line-through' if ok else ''}">
                <span style="width:10px;height:10px;border:1px solid {'#15803D' if ok else '#D6D3D1'};
                      border-radius:2px;flex:none;margin-top:2px;font-size:7px;line-height:9px;
                      text-align:center;color:#15803D">{'✓' if ok else ''}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {['E-mail · QUI 24/09','WhatsApp · SEX 25/09','Story · SÁB 26/09'][i]}</span></div>''')
        resto = f'<div style="font-size:10.5px;color:#A8A29E;padding-left:15px">e mais {total-3}</div>' if total > 3 else ''
        itens = (f'<div style="border-left:1px solid #E7E5E4;padding-left:8px;margin:7px 0 0;'
                 f'display:flex;flex-direction:column;gap:2px">{"".join(linhas)}{resto}</div>')
    return f'''<div style="background:#fff;border:1px solid #E7E5E4;{borda}border-radius:5px;padding:9px 10px">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
           color:#A8A29E;margin-bottom:3px">{proj}</div>
      <div style="font-size:12.5px;line-height:1.35">{nome}</div>
      {itens}
      <div style="display:flex;align-items:center;gap:7px;margin-top:8px;font-size:10.5px;color:#A8A29E">
        <span class="selo" style="border:1px solid {cor};color:{cor};padding:0 5px">{prio}</span>
        <span class="num" style="{'color:#B91C1C;font-weight:600' if atrasada else ''}">{dia}</span>
        <span style="margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{quem}</span>
      </div></div>'''
for nome, cor, n, cards in COLS:
    corpo = ''.join(cartao(*c) for c in cards) or \
        '<div style="padding:22px 0;text-align:center;font-size:11px;color:#A8A29E">nada aqui</div>'
    tarefas += f'''<section style="background:#F5F5F4;border:1px solid #E7E5E4;border-radius:6px;padding:9px;min-height:560px">
      <div style="display:flex;align-items:center;gap:7px;border-bottom:2px solid {cor};
           padding-bottom:6px;margin-bottom:9px">
        <span style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:{cor}">{nome}</span>
        <span class="num" style="margin-left:auto;font-size:11px;color:#A8A29E">{n}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px">{corpo}</div></section>'''
tarefas += '</div>'

pagina('Tarefas.dc.html', 'Tarefas', 'VermeFree · o padrão de nome vem do ClickUp e continua valendo',
       'tarefas', tarefas, marca='VermeFree', cor=VER,
       marca_sub='Desparasitação · adulto e kids · ticket R$ 577',
       contagens={'tarefas':'!9','conteudo':'6','atendimento':'!8','campanhas':'4','creators':'3'},
       direita='<button class="bt">Agrupar</button><button class="bt forte">+ Nova tarefa</button>')
print('ok')
