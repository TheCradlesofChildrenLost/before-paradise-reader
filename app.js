'use strict';
(() => {
  const data = window.READER_DATA;
  const main = document.querySelector('#main');
  const searchDialog = document.querySelector('#search-dialog');
  const noteDialog = document.querySelector('#note-dialog');
  const storageKey = 'before-paradise-reading-v1';
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = {size:19, night:false, bookmarks:[], last:null};
  let storageAvailable = true;
  try { state = {...state,...JSON.parse(localStorage.getItem(storageKey)||'{}')}; } catch {storageAvailable=false;}
  // Navigation history also retains the current tab's reading state in browsers
  // whose embedded preview does not carry localStorage across a reload.
  try {if(history.state?.beforeParadise)state={...state,...history.state.beforeParadise};} catch {}
  // Paragraph positions changed in this edition; keep preferences and chapter
  // bookmarks, but do not resume at an old version's scroll percentage.
  if(state.edition!==data.edition) state.last=null;
  state.edition=data.edition;
  state.size = Math.max(16,Math.min(24,Number(state.size)||19));
  if(!Array.isArray(state.bookmarks)) state.bookmarks=[];
  let currentChapter = null, restoring = false, initialRoute = true, routeGeneration = 0, searchTimer, toastTimer;
  const storageNotice = () => {const el=document.querySelector('#storage-status');if(el)el.textContent=storageAvailable?'阅读位置与书签仅保存在当前浏览器。':'当前浏览器未开放本地存储；进度、字号与折页仅在当前页面内保留。';};
  const persist = () => {
    try {localStorage.setItem(storageKey,JSON.stringify(state));} catch {storageAvailable=false;storageNotice();}
    try {history.replaceState({...history.state,beforeParadise:state},'',location.href);} catch {}
  };
  const applyPreferences = () => {document.body.classList.toggle('night',!!state.night);document.documentElement.style.setProperty('--body-size',state.size+'px');document.querySelector('#theme-toggle').textContent=state.night?'☀':'☾';document.querySelector('#theme-toggle').setAttribute('aria-label',state.night?'切换日间阅读':'切换夜间阅读');};
  const toast = message => {const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900);};
  const chapter = id => data.chapters.find(c=>c.id===id);
  const fullTitle = c => c.title;
  const shortTitle = c => c.title.includes('　')?c.title.split('　').slice(1).join('　'):c.title;
  const number = i => i===0?'序':i<13?String(i).padStart(2,'0'):i===13?'跋Ⅰ':'跋Ⅱ';
  const bookmark = id => state.bookmarks.includes(id);
  const routeLink = (c, label) => `<a href="#${c.id}">${label||escape(c.title)}</a>`;
  const mapPlaces = [
    {n:'01',name:'桑多利亚',en:"San d’Oria",x:34,y:41,ids:[1,5]},
    {n:'02',name:'巴斯图克',en:'Bastok',x:28,y:69,ids:[1,8]},
    {n:'03',name:'温达斯',en:'Windurst',x:69,y:65,ids:[1,9]},
    {n:'04',name:'朱诺与德尔库夫塔',en:'Jeuno / Delkfutt’s Tower',x:49,y:45,ids:[3,4,9]},
    {n:'05',name:'北方与朦胧之地',en:'The North / Dynamis',x:35,y:14,ids:[5,13]},
    {n:'06',name:'诺格与乌迦雷比',en:'Norg / Uggalepih',x:82,y:84,ids:[6,7]},
    {n:'07',name:'拉巴奥与流沙洞',en:'Rabao / Quicksand Caves',x:14,y:77,ids:[8,9]},
    {n:'08',name:'吉·塔与洛·美孚',en:'Zi’Tah / Ro’Maeve',x:67,y:45,ids:[8,9]}
  ];
  function mapFigure(){return `<figure class="atlas-figure"><div class="map-frame"><img src="assets/world-map.png" width="529" height="419" alt="瓦纳迪尔世界地图：Quon与Mindartia两大陆及南方群岛">${mapPlaces.map(p=>`<a class="pin" style="left:${p.x}%;top:${p.y}%" href="#${data.chapters[p.ids[0]].id}" aria-label="${escape(p.name)}：阅读${escape(data.chapters[p.ids[0]].title)}" title="${escape(p.name)}">${p.n}</a>`).join('')}<span class="frame-corner corner-tl" aria-hidden="true"></span><span class="frame-corner corner-tr" aria-hidden="true"></span><span class="frame-corner corner-bl" aria-hidden="true"></span><span class="frame-corner corner-br" aria-hidden="true"></span></div><figcaption><span>VANA’DIEL · 地图上的阅读索引</span><span>编号为篇章示意，非精确地点</span></figcaption></figure>`;}
  function heading(en,title,description=''){return `<header class="page-heading"><span class="eyebrow">${en}</span><h1>${title}</h1>${description?`<p>${description}</p>`:''}</header>`;}
  function home(){
    const last=state.last&&chapter(state.last.id);
    const [titleLead,titleDetail]=data.title.split('：');
    const displayTitle=escape(titleLead)+'：<span class="hero-title-subtitle">'+escape(titleDetail).replace('〈最终幻想XI〉','<span class="keep-together">〈最终幻想XI〉</span>').replace('行动责任','<span class="keep-together">行动责任</span>')+'</span>';
    const groups=[{label:'第一辑',num:'I',title:'城市与委托',art:'city',tone:'sage',indices:[0,1,2,3,4,5]},{label:'第二辑',num:'II',title:'记忆与决定',art:'memory',tone:'sand',indices:[6,7,8,9]},{label:'第三辑',num:'III',title:'乐园与异议',art:'gate',tone:'blue',indices:[10,11,12]},{label:'尾声',num:'IV',title:'获救与余责',art:'hourglass',tone:'rose',indices:[13,14]}];
    main.innerHTML=`<section class="hero"><div class="hero-copy"><span class="eyebrow">A COMMON WORLD / BEFORE PARADISE</span><h1>${displayTitle}</h1><p class="subtitle">本体 · 〈吉拉特的幻影〉 · 原初迪纳米斯</p><p class="intro">一座让陌生人来往的城市，一扇许诺完成世界的门。阿伦特的共同世界与行动问题贯穿这些故事：共同生活由谁安排，拒绝怎样得到回答，后果又交给了谁。</p><div class="reading-links"><a class="primary-link" href="#chapter-00">从序幕读起 <span>→</span></a><a class="quiet-link" href="#contents">翻阅全部篇目</a></div></div>${mapFigure()}</section>
      <div class="edition-strip"><span><strong>十五篇 · 正文约 ${(data.han/10000).toFixed(1)} 万字</strong>　另含注释与参考文献</span>${last?`<a href="#${last.id}" data-resume>接着读：${escape(shortTitle(last))} · ${Math.round(state.last.ratio*100)}% →</a>`:'<span>阅读位置自动保存在此浏览器</span>'}</div>
      <div class="section-heading"><h2>本刊篇目</h2><span>CONTENTS / 从此处展开</span></div>
      <div class="home-columns"><div class="journal-list">${groups.map(g=>`<section class="journal-group" data-tone="${g.tone}"><div class="issue-mark"><img class="issue-illustration" src="assets/illustration-${g.art}.svg" width="420" height="150" alt="" aria-hidden="true"><small>${g.label}</small><strong>${g.num}</strong><span>${g.title}</span></div><div class="article-links">${g.indices.map(i=>`<a href="#${data.chapters[i].id}"><span>${escape(data.chapters[i].title)}</span><small>${data.chapters[i].minutes} 分钟</small></a>`).join('')}</div></section>`).join('')}</div>
      <aside class="column-note"><section class="note-section"><span class="eyebrow">A NOTE TO THE READER</span><h3>写在翻页之前</h3><p>本文保留沿地点展开的叙述，把重心放在行动进入他人生活的时刻。交付物件可以办完差事；提供火把、留在梦域和等待远行者的人，仍有自己的要求。</p><a href="#materials">材料与版本说明 ↗</a></section><section class="note-section"><span class="eyebrow">PLACES IN THESE PAGES</span><h3>循地名寻路</h3><div class="small-index">${mapPlaces.map(p=>`<a href="#${data.chapters[p.ids[0]].id}">${escape(p.name.split('与')[0])} ↗</a>`).join('')}</div></section>${state.bookmarks.length?`<section class="note-section"><span class="eyebrow">YOUR BOOKMARKS</span><h3>折过的页角</h3>${state.bookmarks.map(id=>chapter(id)).filter(Boolean).map(c=>`<p>${routeLink(c)}</p>`).join('')}</section>`:''}<section class="note-section"><span class="eyebrow">MARGINALIA</span><h3>让出处留在身边</h3><p>点击正文中的小注号，可在旁注中查看出处，关闭后仍留在原来的段落。</p><a href="#bibliography">五分区参考文献 ↗</a></section></aside></div>`;
  }
  function contents(){main.innerHTML=heading('CONTENTS / 全部篇目','共同世界中的十五篇。','序幕、十二章与两部分尾声。保留原版结构，可顺序阅读，也可从熟悉的地方进入。')+`<div class="contents-grid">${data.chapters.map((c,i)=>`<article class="chapter-card"><a href="#${c.id}"><div class="card-top"><span class="chapter-number">${number(i)}</span><span>${escape(c.region)}${bookmark(c.id)?'<span class="bookmark-dot">◆</span>':''}</span></div><h2>${escape(shortTitle(c))}</h2><p>${escape(c.excerpt)}</p><div class="card-bottom"><span>约 ${c.minutes} 分钟 · ${c.han.toLocaleString('zh-CN')} 字</span><span>展开阅读 →</span></div></a></article>`).join('')}</div>`;}
  function atlas(){main.innerHTML=heading('ATLAS / 地图索引','从一处地方，进入一段往事。','地点可以重访，来意已经改变。地图编号只供阅读导览，不作游戏内精确定位或任务路线。')+`<div class="atlas-page-grid">${mapFigure()}<div class="place-list">${mapPlaces.map(p=>`<section class="place-row"><div class="place-label"><span class="place-number">${p.n}</span><h2>${escape(p.name)}</h2></div><p class="eyebrow">${escape(p.en)}</p>${p.ids.map(i=>`<p>${routeLink(data.chapters[i])} ↗</p>`).join('')}</section>`).join('')}<section class="place-row"><div class="place-label"><span class="place-number">✧</span><h2>通往天空的路</h2></div><p>神殿、Ark Angels与宿星之座，另见：</p>${[10,11,12].map(i=>`<p>${routeLink(data.chapters[i])} ↗</p>`).join('')}</section></div></div>`;}
  function read(c){
    const i=data.chapters.indexOf(c);currentChapter=c;
    main.innerHTML=`<div class="reading-progress" aria-hidden="true"></div><div class="reader-layout"><aside class="reader-sidebar" aria-label="阅读目录"><div class="sidebar-caption"><span class="eyebrow">CONTENTS</span><a href="#contents">全部篇目 ↗</a></div><nav>${data.chapters.map((other,j)=>`<a class="${c.id===other.id?'active':''}" href="#${other.id}" ${c.id===other.id?'aria-current="page"':''}>${number(j)}　${escape(shortTitle(other))}</a>`).join('')}</nav><div class="section-list"><span class="eyebrow">本篇细目</span><nav>${c.sections.filter(s=>s.level===2).map(s=>`<a href="#${s.id}">${escape(s.title)}</a>`).join('')}</nav></div></aside><article class="reader-main"><div class="reader-mobile-nav"><label for="chapter-select">篇目</label><select id="chapter-select">${data.chapters.map(other=>`<option value="${other.id}" ${other.id===c.id?'selected':''}>${escape(other.title)}</option>`).join('')}</select></div><div class="reader-toolbar"><span><span id="read-percent">0</span>% · 约 ${c.minutes} 分钟</span><div class="tools"><button id="font-down" aria-label="缩小正文字号">A−</button><button id="font-up" aria-label="放大正文字号">A＋</button><button id="bookmark-toggle" aria-pressed="${bookmark(c.id)}">${bookmark(c.id)?'◆ 已折页':'◇ 折页'}</button></div></div><header class="reader-title"><span class="eyebrow">${escape(c.region)} / BEFORE PARADISE</span><h1>${escape(fullTitle(c))}</h1><span class="reader-meta">${c.han.toLocaleString('zh-CN')} 字 · 点击小注号查看旁注</span></header><div class="prose chapter-prose">${c.html}</div><nav class="reading-pagination" aria-label="相邻篇章">${i>0?`<a href="#${data.chapters[i-1].id}"><small>← 上一篇</small>${escape(shortTitle(data.chapters[i-1]))}</a>`:'<a href="#home"><small>← 返回</small>卷首</a>'}${i<14?`<a href="#${data.chapters[i+1].id}"><small>下一篇 →</small>${escape(shortTitle(data.chapters[i+1]))}</a>`:'<a href="#bibliography"><small>延伸阅读 →</small>注释与参考文献</a>'}</nav></article></div>`;
    document.querySelector('#font-down').onclick=()=>resize(-1);
    document.querySelector('#font-up').onclick=()=>resize(1);
    document.querySelector('#bookmark-toggle').onclick=()=>{if(bookmark(c.id))state.bookmarks=state.bookmarks.filter(id=>id!==c.id);else state.bookmarks.push(c.id);persist();const el=document.querySelector('#bookmark-toggle');el.setAttribute('aria-pressed',String(bookmark(c.id)));el.textContent=bookmark(c.id)?'◆ 已折页':'◇ 折页';toast(bookmark(c.id)?'已折好这一页':'已移除页角');};
    document.querySelector('#chapter-select').onchange=e=>{location.hash=e.target.value;};
    setFontButtonState();
  }
  function resize(delta){state.size=Math.max(16,Math.min(24,state.size+delta));applyPreferences();persist();setFontButtonState();toast('正文字号 '+state.size+'px');}
  function setFontButtonState(){const down=document.querySelector('#font-down'),up=document.querySelector('#font-up');if(down)down.disabled=state.size<=16;if(up)up.disabled=state.size>=24;}
  function reference(kind){
    let title,description,body,en;
    if(kind==='notes'){title='注释';description='一百二十二组旁注，保留各项材料的版本与使用范围。';body=data.notesHtml;en='MARGINALIA / 注释';}
    else if(kind==='bibliography'){title='参考文献';description='官方材料、任务与机制见证、游戏研究、人文原典，各归其处。';body=data.bibliographyHtml;en='BIBLIOGRAPHY / 五分区书目';}
    else{title='材料与版本说明';description='研究范围、日英文本与中文译述。';body=data.materialHtml;en='EDITORIAL NOTE / 阅读说明';}
    main.innerHTML=`<div class="reference-page">${heading(en,title,description)}<div class="prose">${body}</div></div>`;
  }
  function openNote(id){if(!data.notes[id])return;document.querySelector('#note-title').textContent='注 '+id.replace('reader-c','').replace('-n','-');document.querySelector('#note-content').innerHTML=data.notes[id];if(!noteDialog.open)noteDialog.showModal();noteDialog.scrollTop=0;}
  function route(){
    const generation=++routeGeneration;
    let id=decodeURIComponent(location.hash.slice(1)||'home');
    const sectionOwner=data.chapters.find(c=>c.sections.some(s=>s.id===id));
    const next=chapter(id)||sectionOwner;
    const sameChapter=next&&currentChapter?.id===next.id;
    const saved=state.last&&next&&state.last.id===next.id?{...state.last}:null;
    const resume=!!window.__resumeReading||(initialRoute&&!!saved&&!sectionOwner);window.__resumeReading=false;initialRoute=false;
    restoring=true;
    if(noteDialog.open)noteDialog.close();
    if(!sameChapter){currentChapter=null;if(next)read(next);else if(id==='home')home();else if(id==='contents')contents();else if(id==='atlas')atlas();else if(id==='materials')reference('materials');else if(id==='notes'||id.startsWith('reader-'))reference('notes');else if(id==='bibliography'||id.startsWith('bib-'))reference('bibliography');else {id='contents';contents();}}
    const active=next?'contents':id.startsWith('reader-')?'notes':id.startsWith('bib-')?'bibliography':id;
    storageNotice();
    document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title=id==='home'?data.title:(next?next.title:({contents:'全部篇目',atlas:'地图索引',notes:'注释',bibliography:'参考文献',materials:'材料与版本说明'}[active]||'在乐园之前'))+' · 在乐园之前';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(generation!==routeGeneration)return;
      const target=document.getElementById(id);
      if(resume&&saved){const prose=document.querySelector('.chapter-prose');const start=window.scrollY+prose.getBoundingClientRect().top-95;window.scrollTo({top:start+saved.ratio*Math.max(1,prose.offsetHeight-innerHeight+120),behavior:'instant'});}
      else if(target)target.scrollIntoView({behavior:'instant',block:'start'});
      else window.scrollTo({top:0,behavior:'instant'});
      restoring=false;updateProgress();
    }));
  }
  function updateProgress(){
    if(!currentChapter||restoring)return;
    const prose=document.querySelector('.chapter-prose');if(!prose)return;
    const start=window.scrollY+prose.getBoundingClientRect().top-95;
    const ratio=Math.max(0,Math.min(1,(scrollY-start)/Math.max(1,prose.offsetHeight-innerHeight+120)));
    const percent=document.querySelector('#read-percent'),bar=document.querySelector('.reading-progress');if(percent)percent.textContent=Math.round(ratio*100);if(bar)bar.style.width=(ratio*100)+'%';
    state.last={id:currentChapter.id,ratio};persist();
  }
  function search(){
    const query=document.querySelector('#search-input').value.trim();const results=document.querySelector('#search-results'),status=document.querySelector('#search-status');
    if(!query){results.innerHTML='';status.textContent='输入关键词，检索十五篇正文。';return;}
    const needle=query.toLocaleLowerCase();let total=0;
    const matches=[];
    for(const c of data.chapters){const text=c.title+'\n'+c.text,lower=text.toLocaleLowerCase();let pos=lower.indexOf(needle),count=0,first=pos;while(pos!==-1){count++;pos=lower.indexOf(needle,pos+Math.max(1,needle.length));}if(count){total+=count;const snippet=text.slice(Math.max(0,first-45),first+query.length+95).replace(/\n+/g,' ');const idx=snippet.toLocaleLowerCase().indexOf(needle);const highlight=idx<0?escape(snippet):escape(snippet.slice(0,idx))+'<mark>'+escape(snippet.slice(idx,idx+query.length))+'</mark>'+escape(snippet.slice(idx+query.length));matches.push(`<a class="search-result" href="#${c.id}" data-search-result><small>${escape(c.region)} · ${count} 处</small><strong>${escape(c.title)}</strong><p>${highlight}……</p></a>`);}}
    status.textContent=matches.length?`在 ${matches.length} 篇正文中找到 ${total} 处。点击篇目进入阅读。`:'正文中未找到。可以缩短关键词，或改用角色／地点的另一语言名称。';results.innerHTML=matches.join('');
  }
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');if(close){document.getElementById(close.dataset.close).close();return;}
    const link=e.target.closest('a');if(!link)return;
    if(link.hasAttribute('data-resume'))window.__resumeReading=true;
    const href=link.getAttribute('href');if(href==='#main'){e.preventDefault();main.focus();main.scrollIntoView();return;}
    if(href?.startsWith('#reader-')){e.preventDefault();openNote(href.slice(1));return;}
    if(href?.startsWith('#')){if(searchDialog.open)searchDialog.close();if(noteDialog.open)noteDialog.close();if(location.hash===href){e.preventDefault();route();}}
  });
  document.querySelector('#search-open').onclick=()=>{searchDialog.showModal();document.querySelector('#search-input').focus();};
  document.querySelector('#search-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,120);});
  document.querySelector('#theme-toggle').onclick=()=>{state.night=!state.night;applyPreferences();persist();};
  for(const dialog of [searchDialog,noteDialog])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  window.addEventListener('hashchange',route);
  let ticking=false;window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(()=>{updateProgress();ticking=false;});}},{passive:true});
  applyPreferences();route();
})();
