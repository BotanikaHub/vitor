/* CENTRAL UI V6 runtime enhancements — preserves existing task behavior/data. */
(() => {
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const priorities={urgent:'Urgente',high:'Alta',normal:'Normal',low:'Baixa'};
  const shortName=(v='')=>String(v).split('|')[0].trim().split(' ').slice(0,2).join(' ');
  const initials=(v='')=>shortName(v).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'—';
  const dateBr=v=>{if(!v)return 'Sem prazo';const p=String(v).split('-');return p.length===3?`${p[2]}/${p[1]}`:v};
  const taskMap=()=>new Map((window.__centralGetTasks?.()||[]).map(t=>[String(t.id),t]));
  const overdue=t=>!!(t?.due && t.status!=='feito' && t.due<'2026-09-08');
  const chip=(text,cls='')=>`<span class="task-chip ${cls}">${esc(text)}</span>`;
  const avatarStack=t=>`<span class="v6-avatar-stack">${(t.assignees||[]).slice(0,3).map(a=>`<span class="v6-avatar" title="${esc(shortName(a))}">${esc(initials(a))}</span>`).join('')||'<span class="v6-avatar empty">—</span>'}</span>`;

  function moveBrandContext(){
    const select=qs('#brandSelect'), toolbar=qs('.global-toolbar');
    if(!select||!toolbar||select.closest('.brand-context'))return;
    const label=document.createElement('label');
    label.className='brand-context';
    label.setAttribute('aria-label','Marca ativa');
    label.innerHTML='<span class="brand-context-label">Marca</span>';
    label.appendChild(select);
    toolbar.prepend(label);
  }

  function rebuildTaskToolbar(){
    const bar=qs('.cu-toolbar');
    if(!bar||bar.dataset.v6Toolbar)return;
    const views=qs('.cu-views',bar), summary=qs('.cu-summary',bar), search=qs('.cu-search',bar);
    const filters=qsa('.cu-filter',bar);
    if(!views||!search)return;
    bar.dataset.v6Toolbar='1';
    const top=document.createElement('div');top.className='cu-toolbar-top';
    const controls=document.createElement('div');controls.className='cu-toolbar-controls';
    top.appendChild(views);if(summary)top.appendChild(summary);
    controls.appendChild(search);filters.forEach(f=>controls.appendChild(f));
    bar.append(top,controls);
    if(!qs('svg',search)) search.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>');
    const input=qs('input',search);if(input){input.type='search';input.placeholder='Buscar tarefa, descrição ou projeto…';input.autocomplete='off'}
  }

  function enhanceBoardCards(){
    const map=taskMap();
    qsa('.cu-card[data-task-id]').forEach(card=>{
      if(card.dataset.v6Card)return;
      const t=map.get(String(card.dataset.taskId));if(!t)return;
      card.dataset.v6Card='1';
      const desc=(t.description||'').replace(/\s+/g,' ').trim();
      const done=(t.checklist||[]).filter(x=>x.done).length,total=(t.checklist||[]).length;
      const comments=(t.comments||[]).length;
      card.innerHTML=`
        <div class="cu-card-top"><span class="cu-card-project">${esc(t.project||'Operação')}</span><span class="cu-card-id">#${esc(String(t.id).slice(-6))}</span></div>
        <div class="cu-card-title">${esc(t.title)}</div>
        ${desc?`<p class="cu-card-desc">${esc(desc)}</p>`:''}
        <div class="cu-card-signals">${chip(t.brand||'Marca','brand-chip')}${chip(priorities[t.priority]||'Normal',`priority-${t.priority||'normal'}`)}${overdue(t)?chip('Em risco','risk-chip'):''}</div>
        <div class="cu-card-foot"><div class="cu-card-people">${avatarStack(t)}<span>${esc(shortName(t.assignees?.[0]||'Sem responsável'))}</span></div><div class="cu-card-foot-right"><span class="row-metrics">✓ ${done}/${total}${comments?` · ◦ ${comments}`:''}</span><span class="due-date ${overdue(t)?'over':''}">${esc(dateBr(t.due))}</span></div></div>`;
    });
  }

  function enhanceWeek(){
    const days=qsa('.cu-week .cu-day');
    if(days.length){
      const dayNames=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
      days.forEach((day,i)=>{
        day.classList.toggle('today',i===1);
        const head=qs('.cu-day-head',day);if(!head)return;
        const left=qs(':scope > div',head);if(left&&!left.classList.contains('cu-day-date'))left.classList.add('cu-day-date');
        const dayName=left?.querySelector('b'); if(dayName) dayName.textContent=dayNames[i]||dayName.textContent;
        const dayDate=left?.querySelector('span'); if(dayDate) dayDate.textContent=dayDate.textContent.replace('/09',' · set');
        let right=qs('.cu-day-head-right',head);
        if(!right){right=document.createElement('div');right.className='cu-day-head-right';head.appendChild(right)}
        const oldToday=qs(':scope > em',head);if(oldToday)oldToday.remove();
        const count=day.querySelectorAll('.cu-week-card[data-task-id]').length;
        right.innerHTML=`<span class="cu-day-count">${count}</span>${i===1?'<em>Hoje</em>':''}`;
      });
    }
    const map=taskMap();
    qsa('.cu-week-card[data-task-id]').forEach(card=>{
      if(card.dataset.v6Week)return;
      const t=map.get(String(card.dataset.taskId));if(!t)return;
      card.dataset.v6Week='1';
      const desc=(t.description||'').replace(/\s+/g,' ').trim();
      card.innerHTML=`<div class="cu-week-card-top"><span class="cu-card-project">${esc(t.project||'Operação')}</span><span class="week-due ${overdue(t)?'over':''}">${esc(dateBr(t.due))}</span></div><b>${esc(t.title)}</b>${desc?`<p>${esc(desc)}</p>`:''}<div class="cu-week-card-foot">${avatarStack(t)}<span>${esc(shortName(t.assignees?.[0]||'Sem responsável'))}</span>${chip(priorities[t.priority]||'Normal',`priority-${t.priority||'normal'}`)}</div>`;
    });
  }

  function enhanceTaskDetail(){
    const drawer=qs('#taskDetailDrawer');if(!drawer?.classList.contains('open'))return;
    const side=qs('.tdetail-side',drawer), grid=qs('.tdetail-grid',side);
    if(side&&grid&&!qs('.tdetail-side-head',side)){
      const status=qs('#detailStatus')?.value||'';
      const priority=qs('#detailPriority')?.value||'';
      const head=document.createElement('div');head.className='tdetail-side-head';
      head.innerHTML='<strong>Contexto da tarefa</strong><span>status, responsáveis e prazos</span>';
      const signals=document.createElement('div');signals.className='tdetail-signals';
      signals.innerHTML=`<span class="detail-signal status-signal" data-status="${esc(status)}">${esc(status||'Status')}</span><span class="detail-signal priority-signal priority-${esc(priority)}">${esc(priorities[priority]||'Normal')}</span>`;
      side.insertBefore(head,grid);side.insertBefore(signals,grid);
    }
    const title=qs('#taskTitleInput',drawer);if(title){title.autocomplete='off';title.spellcheck=false}
  }

  function enhanceAll(){moveBrandContext();rebuildTaskToolbar();enhanceBoardCards();enhanceWeek();enhanceTaskDetail()}
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhanceAll()})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
