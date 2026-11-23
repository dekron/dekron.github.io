import { $, $$, clamp, lerp, rand, randi, RM, FINE, esc, fmtN, ico, hslHex, store, download, paintRange } from './utils.js';
import { CV } from './covers.js';
import { KIND, QUEUE, LOG } from './content.js';
import { createSnake } from './snake.js';
import { initScene } from './scene.js';
import { Rain } from './rain.js';

function copyText(t,msg){const ok=()=>toast(msg||'Скопировано в буфер','ok');const fb=()=>{try{const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();ok();}catch(e){toast('Не удалось скопировать','err')}};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok).catch(fb);else fb();}

/* toasts */
let tid=0;const toastActs={};const TICON={ok:'check',info:'zap',warn:'alert',err:'x'};
function toast(msg,type='info',action){const wrap=$('#toasts'),t=document.createElement('div'),id='t'+(++tid);t.className='toast t-'+type;
t.innerHTML=`${ico(TICON[type]||'zap')}<div class="toast-msg">${msg}</div>${action?`<button class="toast-act" data-action="toast-act" data-t="${id}">${esc(action.label)}</button>`:''}<button class="toast-x" data-action="toast-x" aria-label="Закрыть">${ico('x')}</button>`;
if(action)toastActs[id]=action.fn;wrap.appendChild(t);requestAnimationFrame(()=>t.classList.add('in'));
while(wrap.children.length>4)dismissToast(wrap.firstElementChild,true);t._to=setTimeout(()=>dismissToast(t),action?6500:3800);}
function dismissToast(t,fast){if(!t)return;clearTimeout(t._to);if(fast){t.remove();return}t.classList.add('out');setTimeout(()=>t.remove(),320);}

/* audio */
const AudioSys={ctx:null,on:store.get('dv_sound',true),master:null,dly:null,arpTimer:null,arpIdx:4,vox:null,
ensure(){if(this.ctx)return true;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=this.on?.9:0;
const comp=this.ctx.createDynamicsCompressor();this.master.connect(comp);comp.connect(this.ctx.destination);
this.dly=this.ctx.createDelay(1);this.dly.delayTime.value=.31;const fb=this.ctx.createGain();fb.gain.value=.36;const df=this.ctx.createBiquadFilter();df.type='lowpass';df.frequency.value=2100;
this.dly.connect(df);df.connect(fb);fb.connect(this.dly);const wet=this.ctx.createGain();wet.gain.value=.3;df.connect(wet);wet.connect(this.master);
const dg=this.ctx.createGain();dg.gain.value=.05;const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=185;
[55,55.4,110.3].forEach(f=>{const o=this.ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start();});lp.connect(dg);dg.connect(this.master);
const lfo=this.ctx.createOscillator();lfo.frequency.value=.07;const lg=this.ctx.createGain();lg.gain.value=65;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
this.arpTimer=setInterval(()=>this.arpStep(),260);updateSoundUI();return true;}catch(e){return false}},
note(f,t,dur,vol,type='triangle',dest){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest||this.master);if(this.dly)g.connect(this.dly);o.start(t);o.stop(t+dur+.05);},
arpStep(){if(!this.on||!this.ctx||document.hidden)return;if(Math.random()<.6){const sc=[220,261.63,293.66,329.63,392,440,523.25,587.33];this.arpIdx=clamp(this.arpIdx+[-2,-1,-1,1,1,2][randi(0,5)],0,7);this.note(sc[this.arpIdx],this.ctx.currentTime,.9,.05);if(SceneAPI)SceneAPI.pulse(.55);}},
sfx(n){if(!this.on||!this.ctx)return;const t=this.ctx.currentTime;switch(n){
case'hover':this.note(2100,t,.05,.011,'sine');break;case'click':this.note(880,t,.07,.045,'square');this.note(1320,t+.03,.06,.028,'sine');break;
case'ok':this.note(660,t,.12,.06);this.note(990,t+.09,.16,.06);break;case'err':this.note(150,t,.22,.07,'sawtooth');break;
case'eat':this.note(740,t,.07,.07,'square');this.note(1180,t+.05,.09,.06,'square');break;
case'die':this.note(300,t,.3,.09,'sawtooth');this.note(140,t+.12,.42,.09,'sawtooth');break;case'toggle':this.note(520,t,.09,.05);break;}},
setOn(v){this.on=v;store.set('dv_sound',v);if(v&&!this.ctx)this.ensure();if(this.ctx){if(v&&this.ctx.state==='suspended')this.ctx.resume();this.master.gain.setTargetAtTime(v?.9:0,this.ctx.currentTime,.12);}updateSoundUI();},
hat(t,dest){const b=this.ctx.createBuffer(1,this.ctx.sampleRate*.04,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);const s=this.ctx.createBufferSource();s.buffer=b;const f=this.ctx.createBiquadFilter();f.type='highpass';f.frequency.value=6200;const g=this.ctx.createGain();g.gain.value=.05;s.connect(f);f.connect(g);g.connect(dest);s.start(t);},
voxStart(){if(!this.ensure())return false;if(this.vox)return true;const g=this.ctx.createGain();g.gain.value=.85;g.connect(this.master);let step=0;
const bass=[55,55,65.41,49],arp=[220,329.63,440,329.63,261.63,392,523.25,392];
const iv=setInterval(()=>{if(!this.on||document.hidden){step++;return}const t=this.ctx.currentTime,s=step%16;
if(s%4===0)this.note(bass[(step>>4)%4],t,.24,.15,'sawtooth',g);if(s%2===0)this.note(arp[(s>>1)%8]*(((step>>5)%2)?1.5:1),t,.14,.045,'square',g);if(s%4===2)this.hat(t,g);step++;},130);
this.vox={g,iv};return true;},
voxStop(){if(!this.vox)return;clearInterval(this.vox.iv);try{this.vox.g.disconnect()}catch(e){}this.vox=null;}};
function updateSoundUI(){$$('.snd-btn').forEach(b=>{b.classList.toggle('on',AudioSys.on);b.classList.toggle('live',AudioSys.on&&!!AudioSys.ctx);b.setAttribute('aria-pressed',AudioSys.on);const l=b.querySelector('.snd-lbl');if(l)l.textContent=AudioSys.on?'ВКЛ':'ВЫКЛ';const u=b.querySelector('use');if(u)u.setAttribute('href',AudioSys.on?'#i-sound':'#i-mute');});}
const armAudio=()=>{if(AudioSys.on)AudioSys.ensure();};
window.addEventListener('pointerdown',armAudio,{once:true});window.addEventListener('keydown',armAudio,{once:true});
window.addEventListener('pointerdown',()=>{if(AudioSys.ctx&&AudioSys.ctx.state==='suspended'&&AudioSys.on)AudioSys.ctx.resume();});
function syncVoxBtns(){const p=!!AudioSys.vox;$$('[data-action="vox"]').forEach(b=>{b.classList.toggle('vox-playing',p);const l=b.querySelector('.vox-lbl');if(l)l.textContent=p?'Стоп луп':'Слушать луп';const u=b.querySelector('use');if(u)u.setAttribute('href',p?'#i-pause':'#i-play');});}
function toggleVox(){if(AudioSys.vox){AudioSys.voxStop();toast('Луп остановлен','info');}else{if(!AudioSys.on){AudioSys.setOn(true);toast('Звук включён для демо','info');}if(AudioSys.voxStart())toast('VOX.SYNTH v0.1: бас, арп и хэты синтезируются вживую','ok');else toast('WebAudio недоступен','err');}syncVoxBtns();}

/* state */
let SceneAPI=null,snakeApi=null;
let prio=store.get('dv_priority',[]).filter(id=>QUEUE.some(q=>q.id===id));
let palHues=[187,311,84,42,265];
const PRESETS={187:'ЦИАН',311:'МАГЕНТА',84:'ЛАЙМ',42:'ЯНТАРЬ'};

function setPalette(h,skipStore){h=((h%360)+360)%360;const r=document.documentElement.style;
r.setProperty('--prime',hslHex(h,100,60));r.setProperty('--prime2',hslHex(h+130,95,62));r.setProperty('--prime-b2',hslHex(h+55,100,66));
r.setProperty('--prime-glow',`hsla(${h},100%,60%,.42)`);r.setProperty('--prime-dim',`hsla(${h},100%,60%,.12)`);r.setProperty('--prime-soft',`hsla(${h},100%,60%,.28)`);
if(SceneAPI)SceneAPI.setHue(h);Rain.setColor(h);
const sel=$('#cHue');if(sel)sel.value=PRESETS[h]?String(h):'custom';if(!skipStore)store.set('dv_hue',h);}

/* renders */
function renderLive(){
  $('#featCover').innerHTML=CV.grid;
  const mods=[
    {id:'vox',icon:'wave',acc:'var(--mag)',name:'VOX.SYNTH',d:'Синтвейв-луп на чистом WebAudio — без сэмплов. Кнопка играет по-настоящему.',act:`<button class="btn btn-p btn-sm" data-action="vox">${ico('play')}<span class="vox-lbl">Слушать луп</span></button>`},
    {id:'pal',icon:'dice',acc:'var(--lim)',name:'НЕОН-ПАЛИТРЫ',d:'Генератор пятицветных неон-палитр: копия hex, экспорт JSON, применение к ядру.',act:`<button class="btn btn-s btn-sm" data-action="goto-pal">${ico('zap')}К палитрам</button>`},
    {id:'term',icon:'term',acc:'var(--prime)',name:'DV-TERMINAL',d:'Гостевая консоль: help, need, theme, play. Влияет на сайт по-настоящему.',act:`<button class="btn btn-s btn-sm" data-action="goto-term">${ico('term')}Открыть</button>`},
    {id:'core',icon:'cpu',acc:'var(--vio)',name:'3D-ЯДРО',d:'Сцена с 10 живыми контролами: палитра, частицы, свечение, PNG-экспорт.',act:`<button class="btn btn-s btn-sm" data-action="goto-core">${ico('up')}К ядру</button>`}
  ];
  $('#liveModules').innerHTML=mods.map((m,i)=>`<div class="lmod panel energy rv" style="--acc:${m.acc};--d:${i*70}ms">
    <span class="p-ico" style="width:44px;height:44px">${ico(m.icon)}</span>
    <h3>${m.name}<span class="ver">v0.1</span></h3><p>${m.d}</p>
    <span class="st st-ok"><i></i>РАБОТАЕТ ЗДЕСЬ</span>${m.act}</div>`).join('');
}
function stageHTML(q){return `<span class="st st-${q.stageC}"><i></i>${q.stage}</span>`;}
function renderQueue(){
  $('#queueGrid').innerHTML=QUEUE.map((q,i)=>`<article class="qcard panel energy rv ${prio.includes(q.id)?'needed':''}" style="--acc:${q.acc};--d:${i*60}ms" data-kind="${q.kind}" data-qid="${q.id}">
    <div class="qcover">${q.cover}<span class="qstage">${stageHTML(q)}</span></div>
    <div class="qbody">
      <div><h3 class="qtitle">${q.title}</h3><span class="qkind">${KIND[q.kind]} · ЗАМЫСЕЛ</span></div>
      <p class="qdesc"><b>Пока не существует.</b> ${q.desc}</p>
      <div class="qprog"><small>ПУТЬ ОТ ИДЕИ К БИЛДУ · ${q.p}%</small><div class="bar"><i style="--v:${q.p}%"></i></div></div>
      <div class="qacts">
        <button class="btn btn-s btn-sm need-btn" data-action="need" data-id="${q.id}" aria-pressed="${prio.includes(q.id)}">${ico('heart')}<span class="need-lbl">Мне нужно</span></button>
        <button class="btn btn-ghost btn-sm" data-action="queue-details" data-id="${q.id}">Замысел</button>
      </div>
    </div></article>`).join('');
  syncNeed();
}
function renderLog(){
  $('#logList').innerHTML=LOG.map((l,i)=>`<div class="log-item rv" style="--d:${i*70}ms">
    <span class="log-dot"><i></i></span>
    <div class="log-card panel" style="--acc:${l.acc}">
      <div class="log-meta"><span>ДЕНЬ 0 · ЗАПИСЬ 0${i+1}</span><span class="tag">${l.tag}</span><span class="st st-ok"><i></i>ПРОВЕРЯЕМО</span></div>
      <h3>${l.t}</h3><p>${l.d}</p>
      <button class="btn btn-s btn-sm" data-action="${l.act}">${ico('ar')}${l.lbl}</button>
    </div></div>`).join('')+`<div class="log-item future rv" style="--d:480ms">
    <span class="log-dot"><i></i></span>
    <div class="log-card panel"><div class="log-meta"><span>СЛЕДУЮЩАЯ ЗАПИСЬ</span></div>
      <h3 style="color:var(--dim)">Первый билд из очереди</h3>
      <p>Появится, когда замысел с наибольшим числом сигналов станет играбельным. Порядок определяешь ты — в разделе «Очередь».</p>
      <button class="btn btn-ghost btn-sm" data-action="goto-queue">${ico('ar')}Задать порядок</button>
    </div></div>`;
}
function contactFormHTML(){return `<form id="contactForm" novalidate>
  <div class="frow">
    <div class="field"><label class="f-label" for="cfName">Имя</label><input id="cfName" placeholder="Как к тебе обращаться" autocomplete="name"><small class="ferr"></small></div>
    <div class="field"><label class="f-label" for="cfEmail">Email для ответа</label><input id="cfEmail" type="email" placeholder="you@neon.dev" autocomplete="email"><small class="ferr"></small></div>
  </div>
  <div class="field"><label class="f-label" for="cfTopic">Тема сигнала</label><select id="cfTopic"><option>Идея для очереди</option><option>Фидбек по прототипу</option><option>Коллаборация</option><option>Пилотный курс</option><option>Другое</option></select><small class="ferr"></small></div>
  <div class="field"><label class="f-label" for="cfMsg">Сообщение</label><textarea id="cfMsg" placeholder="Пара абзацев: что за идея, что зацепило, что предложить…"></textarea><small class="ferr"></small></div>
  <button class="btn btn-p btn-block" type="submit">${ico('send')}Собрать письмо</button>
  <p class="form-note"><b>Честно:</b> сервера пока нет — кнопка подготовит письмо в твоём почтовом клиенте, отправишь его ты.</p></form>`;}

/* priority */
function prioText(){return prio.map((id,i)=>{const q=QUEUE.find(x=>x.id===id);return `${i+1}. ${q.title} (${KIND[q.kind].toLowerCase()}) — ${q.stage.toLowerCase()}`;}).join('\n');}
function prioMail(){const body=`Привет, Дмитрий!\n\nМой приоритет для очереди DV-цеха:\n\n${prioText()}\n\n— отправлено со страницы «День 0»`;return `mailto:hello@dvoronin.dev?subject=${encodeURIComponent('Приоритеты очереди // сигнал')}&body=${encodeURIComponent(body)}`;}
function renderPrio(){
  $('#prioCount').textContent=prio.length;
  const list=$('#prioList');
  if(!prio.length){list.innerHTML=`<li class="prio-empty">ПУСТО — И ЭТО ЧЕСТНО<br>жми «мне нужно» на карточках слева</li>`;return;}
  list.innerHTML=prio.map((id,i)=>{const q=QUEUE.find(x=>x.id===id);return `<li class="prio-item" draggable="true" data-pid="${id}">
    <span class="pi-n">${i+1}</span><span class="pi-t">${q.title}<small>${KIND[q.kind]} · ${q.stage}</small></span>
    <span class="pi-ctl"><button data-action="prio-move" data-id="${id}" data-d="-1" aria-label="Выше">▲</button><button data-action="prio-move" data-id="${id}" data-d="1" aria-label="Ниже">▼</button><button class="pi-x" data-action="need" data-id="${id}" aria-label="Убрать">✕</button></span></li>`;}).join('');
}
function syncNeed(){
  $$('[data-action="need"]').forEach(b=>{if(!b.dataset.id)return;const on=prio.includes(b.dataset.id);
    if(b.classList.contains('need-btn')){b.classList.toggle('needed',on);b.setAttribute('aria-pressed',on);const l=b.querySelector('.need-lbl');if(l)l.textContent=on?'В приоритете ✓':'Мне нужно';}});
  $$('.qcard').forEach(c=>c.classList.toggle('needed',prio.includes(c.dataset.qid)));
  renderPrio();
}
function savePrio(){store.set('dv_priority',prio);}
function toggleNeed(id){
  const q=QUEUE.find(x=>x.id===id);if(!q)return;
  const idx=prio.indexOf(id);
  if(idx>=0){prio.splice(idx,1);savePrio();syncNeed();AudioSys.sfx('toggle');
    toast(`«${q.title}» убран из приоритета`,'warn',{label:'Вернуть',fn:()=>{prio.splice(Math.min(idx,prio.length),0,id);savePrio();syncNeed();}});
  }else{prio.push(id);savePrio();syncNeed();AudioSys.sfx('ok');
    toast(`«${q.title}» в приоритете — позиция #${prio.length}`,'ok');}
}
function movePrio(id,d){const i=prio.indexOf(id),j=i+d;if(i<0||j<0||j>=prio.length)return;prio.splice(i,1);prio.splice(j,0,id);savePrio();syncNeed();AudioSys.sfx('toggle');}
function initPrioDrag(){
  const list=$('#prioList');let dragId=null;
  list.addEventListener('dragstart',e=>{const li=e.target.closest('.prio-item');if(!li)return;dragId=li.dataset.pid;li.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(x){}});
  list.addEventListener('dragover',e=>{e.preventDefault();const li=e.target.closest('.prio-item');$$('.prio-item').forEach(x=>x.classList.remove('drop-target'));if(li&&li.dataset.pid!==dragId)li.classList.add('drop-target');});
  list.addEventListener('drop',e=>{e.preventDefault();const li=e.target.closest('.prio-item');if(!li||!dragId)return;
    const from=prio.indexOf(dragId),to=prio.indexOf(li.dataset.pid);if(from<0||to<0)return;
    prio.splice(from,1);prio.splice(to,0,dragId);savePrio();syncNeed();AudioSys.sfx('toggle');});
  list.addEventListener('dragend',()=>{dragId=null;$$('.prio-item').forEach(x=>x.classList.remove('dragging','drop-target'));});
}
function setFilter(f){$$('#queueFilters [data-f]').forEach(c=>c.classList.toggle('on',c.dataset.f===f));
  $$('#queueGrid .qcard').forEach(c=>{const show=f==='all'||c.dataset.kind===f;c.classList.toggle('filtered-out',!show);if(show){c.classList.remove('in');void c.offsetWidth;c.classList.add('in');}});}

/* modal */
let modalCleanup=null,lastFocus=null;
function openModal(html,opt={}){const root=$('#modalRoot'),was=root.classList.contains('open');closeModal(true);if(!was)lastFocus=document.activeElement;
root.innerHTML=`<div class="modal-back"><div class="modal ${opt.cls||''}" role="dialog" aria-modal="true" aria-label="${esc(opt.label||'Диалог')}"><button class="modal-x" data-action="modal-close" aria-label="Закрыть">${ico('x')}</button><div class="modal-body">${html}</div></div></div>`;
root.classList.add('open');document.body.classList.add('lock');const back=root.firstElementChild;
back.addEventListener('pointerdown',e=>{if(e.target===back)closeModal();});
back.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const f=Array.from(back.querySelectorAll('button,[href],input,select,textarea')).filter(x=>x.offsetParent!==null);if(!f.length)return;const a=f[0],b=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}});
if(opt.onOpen)modalCleanup=opt.onOpen(back)||null;
const f=back.querySelector('.modal-body button,.modal-body input,.modal-body select')||back.querySelector('.modal-x');if(f)f.focus();}
function closeModal(silent){const root=$('#modalRoot');if(!root.classList.contains('open'))return;
if(modalCleanup){try{modalCleanup()}catch(e){}modalCleanup=null;}
root.classList.remove('open');root.innerHTML='';document.body.classList.remove('lock');
if(!silent&&lastFocus&&lastFocus.focus)lastFocus.focus();}
function openQueue(id){
  const q=QUEUE.find(x=>x.id===id);if(!q)return;
  openModal(`<div class="gm-cover">${q.cover}</div>
  <div class="gm-head"><div><div class="gm-genre">${KIND[q.kind]} · ЗАМЫСЕЛ</div><h3 class="gm-title">${q.title}</h3></div>${stageHTML(q)}</div>
  <div class="gm-now">${ico('alert')}<span><b>Статус честно:</b> этого ещё не существует. ${q.next}</span></div>
  <p class="gm-long">${q.long}</p>
  <div class="block-t" style="color:var(--prime)">ЧТО ЗАДУМАНО</div>
  <div class="gm-feats">${q.plan.map(f=>`<div class="gm-feat">${ico('zap')}<span>${f}</span></div>`).join('')}</div>
  <div class="block-t" style="color:var(--ok)">СЧИТАЮ ГОТОВЫМ, КОГДА</div>
  <div class="gm-specs">${q.ready.map((r,i)=>`<div class="spec"><span>Критерий 0${i+1}</span><b>${r}</b></div>`).join('')}</div>
  <div class="gm-acts"><button class="btn btn-p need-btn" data-action="need" data-id="${q.id}">${ico('heart')}<span class="need-lbl">Мне нужно</span></button>
  <button class="btn btn-s" data-action="prio-mail">${ico('send')}Отправить приоритет</button></div>`,{label:q.title,cls:'modal-wide'});
  syncNeed();
}
function openLesson(){
  openModal(`<div class="modal-kicker">БЕСПЛАТНЫЙ УРОК 0.1 · УЖЕ ГОТОВ</div><h3 class="modal-title">КАК Я ДЕЛАЮ ИГРЫ С ИИ</h3>
  <div class="lesson">
    <h4>1. ИИ — джуниор, а не оракул</h4>
    <p>Нейросеть пишет быстрый и уверенный код — и так же уверенно ошибается. Относись к ней как к способному джуниору: ставь задачу с критериями готовности, проверяй каждый дифф и не принимай «работает» на слово. Твоя суперсила — вкус, её — скорость.</p>
    <h4>2. Пайплайн за пять шагов</h4>
    <ol><li><b>Искра:</b> одна фраза о чувстве игрока.</li><li><b>Промпт:</b> роль, стек, ограничения, критерии готовности.</li><li><b>Прототип:</b> играбельный билд за вечер — без графики, но с core loop.</li><li><b>Полировка:</b> вручную — баланс, баги, утечки, 60 FPS.</li><li><b>Полка:</b> билд переезжает в «живое» только когда его можно потрогать.</li></ol>
    <h4>3. Промпт, который реально работает</h4>
    <pre>ТЫ — senior gameplay-разработчик на vanilla JS + Canvas.
ЗАДАЧА: прототип неоновой «змейки» 20×20 в одном HTML-файле.
ОГРАНИЧЕНИЯ: без библиотек; 60 FPS; управление WASD и свайп.
СТИЛЬ: фон #05070f, неон cyan/magenta, свечение через shadowBlur.
КРИТЕРИИ ГОТОВНОСТИ: счёт, рекорд в localStorage, экран смерти
с рестартом, никаких утечек requestAnimationFrame при перезапуске.
Сначала опиши архитектуру в 5 пунктах, потом выдай код целиком.</pre>
    <h4>4. Правило двадцати минут</h4>
    <p>Если ИИ двадцать минут не может починить баг — стоп. Разбей задачу мельче, дай минимальный пример или перепиши кусок сам. Диалог — инструмент, а не религия.</p>
    <h4>5. Домашка</h4>
    <p>Собери свою змейку по промпту выше и сравни с моим GRID RUNNER — он сделан ровно по этому пайплайну. Найди три отличия и осознанно укради одно решение. Получилось — напиши мне: такие истории двигают пилот ближе к старту.</p>
    <div class="lesson-acts">
      <button class="btn btn-p" data-action="play-snake">${ico('play')}Открыть GRID RUNNER</button>
      <button class="btn btn-s" data-action="goto-wait">${ico('send')}В лист пилота</button>
    </div>
  </div>`,{label:'Бесплатный урок',cls:'modal-wide'});
}

const openSnake = createSnake({ openModal, AudioSys, setSnakeApi: api => { snakeApi = api; } });

/* glitch forge */
const GF_HUES={cyan:['#00f0ff','#ff2bd6'],magenta:['#ff2bd6','#00f0ff'],lime:['#a8ff3e','#3d7bff'],amber:['#ffc233','#ff3355']};
function glitchCSS(sel,o){const a=(o.int/100*12).toFixed(1),b=(o.int/100*7).toFixed(1);
return `${sel}{position:relative;display:inline-block;font-family:'Russo One',sans-serif;color:#fff;text-shadow:0 0 12px ${o.c1};letter-spacing:.03em;${o.scan?'background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 3px);padding:.08em .18em;':''}}
${sel}::before,${sel}::after{content:attr(data-text);position:absolute;inset:0;opacity:.85;pointer-events:none;${o.scan?'padding:.08em .18em;':''}}
${sel}::before{color:${o.c1};animation:gfA ${o.speed}s steps(1,end) infinite;}
${sel}::after{color:${o.c2};animation:gfB ${o.speed}s steps(1,end) infinite;}
@keyframes gfA{0%,100%{clip-path:inset(0 0 100% 0);transform:none}10%{clip-path:inset(8% 0 64% 0);transform:translate(-${a}px,-2px)}20%{clip-path:inset(52% 0 12% 0);transform:translate(${a}px,2px)}30%{clip-path:inset(0 0 100% 0);transform:none}55%{clip-path:inset(68% 0 4% 0);transform:translate(-${b}px,1px)}65%{clip-path:inset(20% 0 58% 0);transform:translate(${b}px,-1px)}75%{clip-path:inset(0 0 100% 0);transform:none}}
@keyframes gfB{0%,100%{clip-path:inset(0 0 100% 0);transform:none}12%{clip-path:inset(60% 0 10% 0);transform:translate(${a}px,2px)}22%{clip-path:inset(10% 0 72% 0);transform:translate(-${a}px,-2px)}32%{clip-path:inset(0 0 100% 0);transform:none}58%{clip-path:inset(30% 0 44% 0);transform:translate(${b}px,-1px)}68%{clip-path:inset(76% 0 2% 0);transform:translate(-${b}px,1px)}78%{clip-path:inset(0 0 100% 0);transform:none}}`;}
function gfOpts(){const h=GF_HUES[$('#gfHue').value]||GF_HUES.cyan;return{text:$('#gfText').value.trim()||'ДЕНЬ НОЛЬ',int:+$('#gfInt').value,speed:(+$('#gfSpeed').value/100).toFixed(2),c1:h[0],c2:h[1],scan:$('#gfScan').checked};}
function gfUpdate(){const o=gfOpts(),live=$('#gfLive');live.textContent=o.text;live.dataset.text=o.text;
$('#gfStyle').textContent=glitchCSS('.gf-live',o);$('#gfCode').textContent=glitchCSS('.glitch',o);
$('#oInt').textContent=o.int;$('#oGSpeed').textContent=(+o.speed).toFixed(1)+'с';['gfInt','gfSpeed'].forEach(id=>paintRange($('#'+id)));}
function gfDownload(){const o=gfOpts(),css=glitchCSS('.glitch',o),t=esc(o.text);
download('glitch-forge.html',`<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>GLITCH.FORGE — export</title>\n<link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet">\n<style>\nbody{margin:0;min-height:100vh;display:grid;place-items:center;background:#05070f}\n.glitch{font-size:clamp(2rem,8vw,4rem)}\n${css}\n</style>\n</head>\n<body>\n<div class="glitch" data-text="${t}">${t}</div>\n<!-- GLITCH.FORGE v0.1 · день 0 · dvoronin.dev -->\n</body>\n</html>`,'text/html;charset=utf-8');
toast('Готовый .HTML скачан — открывай в браузере','ok');}

/* palette */
function palGen(){const b=randi(0,359);palHues=[b,b+25,b+140,b+200,b+320].map(h=>((h%360)+360)%360);palRender();}
function palRender(){$('#palRow').innerHTML=palHues.map(h=>{const hex=hslHex(h,100,60);return `<button class="sw" style="--c:${hex}" data-action="pal-copy" data-hex="${hex}" aria-label="Скопировать ${hex}"><span class="sw-c"></span><span class="sw-h">${hex.toUpperCase()}</span></button>`;}).join('');}

/* terminal */
const term={hist:[],hi:0};
function tprint(txt,cls){const out=$('#termOut'),d=document.createElement('div');d.className='ln'+(cls?' '+cls:'');d.innerHTML=txt;out.appendChild(d);out.scrollTop=out.scrollHeight;}
function termExec(raw){const v=raw.trim();if(!v)return;tprint(`<span class="mag">guest@dv-os:~$</span> ${esc(v)}`);term.hist.push(v);term.hi=term.hist.length;
const[a0,...rest]=v.split(/\s+/),cmd=a0.toLowerCase(),arg=(rest[0]||'').toLowerCase();
const hues={cyan:187,magenta:311,lime:84,amber:42};
switch(cmd){
case'help':tprint('команды:','dim');[['help','список'],['live','что уже работает'],['queue','замыслы в очереди'],['need <id>','добавить в приоритет (drift, synapse, waste, ghost, deck, hud, course)'],['prio','твой приоритет'],['play','GRID RUNNER'],['lesson','бесплатный урок'],['theme cyan|magenta|lime|amber','палитра ядра'],['sound on|off','звук'],['day','какой сегодня день'],['contact','связь'],['clear','очистить']].forEach(c=>tprint(`  <span class="acc">${c[0]}</span> — ${c[1]}`));break;
case'live':tprint('  GRID RUNNER · GLITCH.FORGE · VOX.SYNTH · ПАЛИТРЫ · ТЕРМИНАЛ · 3D-ЯДРО','ok');tprint('всё — на этой странице, всё — работает.','dim');break;
case'queue':QUEUE.forEach(q=>tprint(`  <span class="acc">${q.id}</span> · ${q.title} · <span class="warn">${q.stage}</span> · не существует`));tprint('«need drift» — поставить первым в твоём приоритете.','dim');break;
case'need':{const q=QUEUE.find(x=>x.id===arg);if(!q){tprint('usage: need drift|synapse|waste|ghost|deck|hud|course','err');break;}
if(prio.includes(q.id))tprint(`${q.title} уже в приоритете (#${prio.indexOf(q.id)+1}).`,'warn');else{toggleNeed(q.id);tprint(`+ ${q.title} → приоритет #${prio.length} ✓`,'ok');}break;}
case'prio':if(!prio.length)tprint('приоритет пуст — и это честно. «need drift»?','dim');else prio.forEach((id,i)=>{const q=QUEUE.find(x=>x.id===id);tprint(`  ${i+1}. ${q.title}`,'acc');});break;
case'play':tprint('загрузка прототипа #001…','warn');setTimeout(openSnake,350);break;
case'lesson':tprint('открываю урок 0.1…','acc');setTimeout(openLesson,250);break;
case'theme':if(hues[arg]!=null){setPalette(hues[arg]);tprint(`палитра ядра → ${arg.toUpperCase()} ✓`,'acc');AudioSys.sfx('ok');}else tprint('usage: theme cyan|magenta|lime|amber','err');break;
case'sound':if(arg==='on'||arg==='off'){AudioSys.setOn(arg==='on');tprint('звук: '+(arg==='on'?'ВКЛ ✓':'ВЫКЛ'),'acc');}else tprint('usage: sound on|off','err');break;
case'day':tprint('ДЕНЬ 0. Всё только начинается — и это видно на витрине.','acc');break;
case'whoami':tprint('Дмитрий Воронин · начало пути · строю публично в паре с ИИ.','acc');break;
case'contact':tprint('email: <span class="acc">hello@dvoronin.dev</span> · форма — в разделе «Сигнал».');break;
case'date':tprint(new Date().toLocaleString('ru-RU'),'acc');break;
case'clear':$('#termOut').innerHTML='';break;
case'sudo':tprint('доступ запрещён: у цеха пока нет даже бэкенда, не то что root ;)','err');break;
case'hello':case'hi':case'привет':tprint('привет, странник. это день ноль. «help» — дальше.','acc');break;
case'exit':tprint('выход невозможен: очередь сама себя не соберёт.','mag');break;
default:tprint(`не найдено: ${esc(cmd)}. попробуй «help».`,'err');AudioSys.sfx('err');}}
function initTerm(){tprint('DV-OS v0.1 — гостевая сессия. ДЕНЬ 0.','acc');tprint('подсказка: «help», «need drift», «theme magenta», «play».','dim');
const inp=$('#termIn');
inp.addEventListener('keydown',e=>{if(e.key==='Enter'){termExec(inp.value);inp.value='';}
else if(e.key==='ArrowUp'){e.preventDefault();term.hi=Math.max(0,term.hi-1);inp.value=term.hist[term.hi]||'';}
else if(e.key==='ArrowDown'){e.preventDefault();term.hi=Math.min(term.hist.length,term.hi+1);inp.value=term.hist[term.hi]||'';}
else if(e.key==='Tab'){e.preventDefault();const cmds=['help','live','queue','need','prio','play','lesson','theme','sound','day','whoami','contact','date','clear'];const m=cmds.filter(c=>c.startsWith(inp.value.trim().toLowerCase()));if(m.length===1)inp.value=m[0]+' ';}});
$('#termPanel').addEventListener('click',()=>{if(!String(window.getSelection()))inp.focus();});}

/* loop */
let heroInView=true,scrollYc=0,lastPY=-1,fpsF=0,fpsL=performance.now();
const cursor={x:innerWidth/2,y:innerHeight/2,tx:innerWidth/2,ty:innerHeight/2};
window.addEventListener('pointermove',e=>{cursor.tx=e.clientX;cursor.ty=e.clientY;},{passive:true});
window.addEventListener('scroll',()=>{scrollYc=window.scrollY;const dh=document.documentElement.scrollHeight-innerHeight;
$('#progressBar').style.transform=`scaleX(${dh>0?scrollYc/dh:0})`;$('#nav').classList.toggle('scrolled',scrollYc>10);$('#toTop').classList.toggle('show',scrollYc>700);},{passive:true});
const pxEls=$$('.px[data-px]');
function mainLoop(ts){requestAnimationFrame(mainLoop);if(document.hidden)return;
const dt=Math.min(.05,(ts-(mainLoop._l||ts))/1000)||.016;mainLoop._l=ts;
if(FINE&&!RM){cursor.x=lerp(cursor.x,cursor.tx,.14);cursor.y=lerp(cursor.y,cursor.ty,.14);$('#cursorGlow').style.transform=`translate(${cursor.x-180}px,${cursor.y-180}px)`;}
if(SceneAPI&&heroInView){SceneAPI.tick(dt,ts/1000);fpsF++;if(ts-fpsL>500){$('#hudFps').textContent=Math.round(fpsF*1000/(ts-fpsL))+' FPS';fpsF=0;fpsL=ts;}}
Rain.tick(ts);
if(!RM&&innerWidth>900&&scrollYc!==lastPY){lastPY=scrollYc;pxEls.forEach(el=>{el.style.transform=`translate3d(0,${scrollYc*parseFloat(el.dataset.px)}px,0)`;});}}

/* typed/counters */
const PHRASES=['начинаю с чистого листа — публично','первый прототип уже играбелен','очередь строят ваши сигналы','ИИ — напарник, не витрина'];
function startTyped(){const el=$('#typed');if(RM){el.textContent=PHRASES[0];return;}let pi=0,ci=0,del=false;
(function step(){const p=PHRASES[pi];el.textContent=p.slice(0,ci);let w=del?26:52;
if(!del&&ci===p.length){w=1700;del=true;}else if(del&&ci===0){del=false;pi=(pi+1)%PHRASES.length;w=350;}else ci+=del?-1:1;
setTimeout(step,w);})();}
function startCounters(){$$('[data-count]').forEach(el=>{const t=+el.dataset.count;if(RM||t===0){el.textContent=fmtN(t);return;}
const t0=performance.now(),dur=1100;(function tick(now){const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=fmtN(t*e);if(p<1)requestAnimationFrame(tick);})(t0);});}

/* observers */
function initObservers(){
const rio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');rio.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
$$('.rv').forEach(el=>rio.observe(el));
const HUES={top:0,live:100,queue:-40,log:0,learn:-40,about:25,contact:-70};
const spy=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const id=e.target.dataset.sec;
$$('.nav-a').forEach(a=>{const on=a.getAttribute('href')==='#'+id;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
$('#aurora').style.filter=`hue-rotate(${HUES[id]||0}deg)`;}),{rootMargin:'-40% 0px -55% 0px'});
$$('section[data-sec]').forEach(s=>spy.observe(s));
new IntersectionObserver(es=>es.forEach(e=>{heroInView=e.isIntersecting;const s=$('#hudState');if(s)s.textContent=heroInView?'ACTIVE':'IDLE';}),{rootMargin:'120px'}).observe($('#coreStage'));}

/* forms */
function setErr(input,msg){const f=input.closest('.field')||input.parentElement;const err=f.querySelector('.ferr');if(err)err.textContent=msg||'';input.classList.toggle('bad',!!msg);input.setAttribute('aria-invalid',!!msg);if(msg)AudioSys.sfx('err');return!msg;}
const emailOK=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function pushLead(kind,data){const a=store.get('dv_leads',[]);a.push({kind,...data,ts:Date.now()});store.set('dv_leads',a);}
function draftBlock(title,msg,subject,body,extraBtn){
return `<div class="ok-block"><span class="ok-ic">${ico('check')}</span><h4>${title}</h4><p>${msg}</p>
<div class="ok-acts"><a class="btn btn-p btn-sm" href="mailto:hello@dvoronin.dev?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">${ico('send')}Открыть письмо</a>
<button class="btn btn-s btn-sm" data-action="copy" data-copy="${esc(body)}">${ico('copy')}Скопировать текст</button>${extraBtn||''}</div>
<p style="font-family:var(--fm);font-size:9.5px;color:var(--dim)">ЧЕРНОВИК СОХРАНЁН НА УСТРОЙСТВЕ · ОТПРАВКА — ЗА ТОБОЙ</p></div>`;}
document.addEventListener('submit',e=>{const f=e.target;
if(f.id==='waitForm'){e.preventDefault();const n=$('#wfName'),em=$('#wfEmail'),g=$('#wfGoal');
let ok=setErr(n,n.value.trim().length>=2?'':'Минимум 2 символа');ok=setErr(em,emailOK(em.value.trim())?'':'Похоже, в email опечатка')&&ok;
if(!ok)return;const name=n.value.trim(),email=em.value.trim(),goal=g.value.trim();
pushLead('pilot',{name,email,goal});
const body=`Привет, Дмитрий!\n\nХочу в пилотный поток «Геймдев с ИИ» (10 мест за фидбек).\n\nИмя: ${name}\nEmail: ${email}\nЦель на 2 месяца: ${goal||'—'}\n\nГотов(а) давать подробный фидбек по каждому модулю.\n\n— заявка со страницы «День 0»`;
f.outerHTML=draftBlock('ЧЕРНОВИК ЗАЯВКИ ГОТОВ','Нажми «Открыть письмо» — заявка уйдёт мне напрямую. Место в листе закрепится после ответа.',`Пилот «Геймдев с ИИ» // заявка`,body);
toast('Заявка собрана — осталось отправить письмо','ok');AudioSys.sfx('ok');}
else if(f.id==='contactForm'){e.preventDefault();const n=$('#cfName'),em=$('#cfEmail'),m=$('#cfMsg');
let ok=setErr(n,n.value.trim().length>=2?'':'Минимум 2 символа');ok=setErr(em,emailOK(em.value.trim())?'':'Похоже, в email опечатка')&&ok;ok=setErr(m,m.value.trim().length>=10?'':'Минимум 10 символов — расскажи чуть подробнее')&&ok;
if(!ok)return;const name=n.value.trim(),email=em.value.trim(),topic=$('#cfTopic').value,msg=m.value.trim();
pushLead('signal',{name,email,topic,msg});
const body=`Привет, Дмитрий!\n\nТема: ${topic}\n\n${msg}\n\n— ${name}\nОтвет: ${email}\n\n— со страницы «День 0»`;
$('#contactBox').innerHTML=draftBlock('ПИСЬМО СОБРАНО','Открой его в почтовом клиенте и нажми «отправить» — я отвечу в течение 24 часов.',`${topic} // сигнал со страницы`,body,`<button class="btn btn-ghost btn-sm" data-action="contact-again">${ico('reset')}Ещё сигнал</button>`);
toast('Черновик готов — отправка за тобой','ok');AudioSys.sfx('ok');}});

/* menu */
function toggleMenu(force){const open=force!=null?force:!$('#menu').classList.contains('open');
$('#menu').classList.toggle('open',open);document.body.classList.toggle('menu-open',open);
const b=$('.burger');b.classList.toggle('x',open);b.setAttribute('aria-expanded',open);}
$$('#menu a').forEach(a=>a.addEventListener('click',()=>{toggleMenu(false);AudioSys.sfx('click');}));

/* goto helpers */
function gotoEl(sel,focusSel){closeModal();const el=$(sel);if(el)el.scrollIntoView({behavior:RM?'auto':'smooth'});
if(focusSel)setTimeout(()=>{const f=$(focusSel);if(f)f.focus({preventScroll:true});},RM?0:500);}

/* delegation */
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=el.dataset.id;
if(a!=='toast-x'&&a!=='toast-act')AudioSys.sfx('click');
switch(a){
case'sound-toggle':AudioSys.setOn(!AudioSys.on);AudioSys.sfx('toggle');toast(AudioSys.on?'Звук включён':'Звук выключен','info');break;
case'menu':toggleMenu();break;
case'modal-close':closeModal();break;
case'play-snake':openSnake();break;
case'lesson':openLesson();break;
case'queue-details':openQueue(id);break;
case'need':toggleNeed(id);break;
case'prio-move':movePrio(id,+el.dataset.d);break;
case'prio-copy':if(!prio.length){toast('Приоритет пуст — отметь хоть один замысел','warn');break;}copyText(prioText(),'Приоритет скопирован — вставляй куда угодно');break;
case'prio-mail':if(!prio.length){toast('Сначала отметь «мне нужно» на карточках','warn');break;}window.location.href=prioMail();toast('Открываю почтовый клиент со списком…','info');break;
case'prio-reset':{if(!prio.length)break;const snap=[...prio];prio=[];savePrio();syncNeed();toast('Приоритет очищен','warn',{label:'Вернуть',fn:()=>{prio=snap;savePrio();syncNeed();}});break;}
case'filter':setFilter(el.dataset.f);break;
case'acc':{const acc=el.closest('.acc');const open=acc.classList.toggle('open');el.setAttribute('aria-expanded',open);break;}
case'goto-forge':gotoEl('#forge');break;
case'goto-pal':gotoEl('#palPanel');break;
case'goto-term':gotoEl('#termPanel','#termIn');break;
case'goto-core':gotoEl('#top');break;
case'goto-queue':gotoEl('#queue');break;
case'goto-wait':gotoEl('#waitCard','#wfName');break;
case'contact-again':$('#contactBox').innerHTML=contactFormHTML();break;
case'vox':toggleVox();break;
case'gf-copy':copyText($('#gfCode').textContent,'CSS скопирован');break;
case'gf-html':gfDownload();break;
case'gf-rand':{$('#gfInt').value=randi(30,95);$('#gfSpeed').value=randi(30,220);const k=Object.keys(GF_HUES);$('#gfHue').value=k[randi(0,k.length-1)];gfUpdate();toast('Глитч пересобран — крути дальше','info');break;}
case'pal-gen':palGen();AudioSys.sfx('toggle');break;
case'pal-copy':copyText(el.dataset.hex,`${el.dataset.hex.toUpperCase()} скопирован`);break;
case'pal-apply':setPalette(palHues[0]);toast('Палитра ушла в ядро сцены ✦','ok');AudioSys.sfx('ok');break;
case'pal-export':download('dv-neon-palette.json',JSON.stringify({name:'DV neon palette · day 0',colors:palHues.map(h=>hslHex(h,100,60))},null,2),'application/json');toast('Палитра экспортирована в JSON','ok');break;
case'c-reset':if(SceneAPI){setPalette(187);SceneAPI.setParts(900);SceneAPI.setSpeed(1);SceneAPI.setGlow(.6);SceneAPI.setWire(true);SceneAPI.setGrid(true);SceneAPI.setAuto(!RM);SceneAPI.resetView();syncConsole();toast('Сцена сброшена','info');}break;
case'c-rand':if(SceneAPI){setPalette(randi(0,359));SceneAPI.setParts(randi(6,36)*50);SceneAPI.setSpeed(rand(.4,1.8));SceneAPI.setGlow(rand(.3,.95));SceneAPI.setWire(Math.random()>.25);SceneAPI.setGrid(Math.random()>.25);syncConsole();toast('Ядро рандомизировано','info');}break;
case'c-shot':if(SceneAPI){const u=SceneAPI.exportPNG(),l=document.createElement('a');l.href=u;l.download='dv-core-day0.png';document.body.appendChild(l);l.click();l.remove();toast('Кадр ядра сохранён в PNG','ok');}break;
case'snake-start':if(snakeApi)snakeApi.start();break;
case'snake-restart':if(snakeApi)snakeApi.restart();break;
case'snake-pause':if(snakeApi)snakeApi.pauseToggle();break;
case'toast-act':{const fn=toastActs[el.dataset.t];if(fn)fn();delete toastActs[el.dataset.t];dismissToast(el.closest('.toast'));break;}
case'toast-x':dismissToast(el.closest('.toast'));break;
case'top':window.scrollTo({top:0,behavior:RM?'auto':'smooth'});break;
case'copy':copyText(el.dataset.copy);break;}});
document.addEventListener('input',e=>{const el=e.target;switch(el.id){
case'cHue':if(el.value!=='custom')setPalette(+el.value);break;
case'cParts':if(SceneAPI)SceneAPI.setParts(+el.value);$('#oParts').textContent=el.value;paintRange(el);break;
case'cSpeed':if(SceneAPI)SceneAPI.setSpeed(el.value/100);$('#oSpeed').textContent=el.value+'%';paintRange(el);break;
case'cGlow':if(SceneAPI)SceneAPI.setGlow(el.value/100);$('#oGlow').textContent=el.value+'%';paintRange(el);break;
case'cWire':if(SceneAPI)SceneAPI.setWire(el.checked);break;
case'cGrid':if(SceneAPI)SceneAPI.setGrid(el.checked);break;
case'cAuto':if(SceneAPI)SceneAPI.setAuto(el.checked);break;
case'gfText':case'gfInt':case'gfSpeed':case'gfHue':case'gfScan':gfUpdate();break;
case'snakeSpeed':if(snakeApi)snakeApi.setSpeed(el.value);break;}});
document.addEventListener('keydown',e=>{
if(e.key==='Escape'){if($('#modalRoot').classList.contains('open'))closeModal();else if($('#menu').classList.contains('open'))toggleMenu(false);return;}
const tag=(e.target.tagName||'').toLowerCase();
if(tag==='input'||tag==='textarea'||tag==='select'||$('#modalRoot').classList.contains('open'))return;
if(e.metaKey||e.ctrlKey||e.altKey)return;const k=e.key.toLowerCase();
if(k==='t'||k==='е'){gotoEl('#termPanel','#termIn');}
else if(k==='m'||k==='ь'){AudioSys.setOn(!AudioSys.on);toast(AudioSys.on?'Звук включён':'Звук выключен','info');}});
let lastHover=0;
if(FINE)document.addEventListener('mouseover',e=>{if(!e.target.closest('.btn,.ibtn,.chip,.qcard,.sw,a'))return;const n=performance.now();if(n-lastHover<90)return;lastHover=n;AudioSys.sfx('hover');});

function syncConsole(){if(!SceneAPI)return;const P=SceneAPI.P;
$('#cParts').value=P.parts;$('#oParts').textContent=P.parts;
$('#cSpeed').value=Math.round(P.speed*100);$('#oSpeed').textContent=Math.round(P.speed*100)+'%';
$('#cGlow').value=Math.round(P.glow*100);$('#oGlow').textContent=Math.round(P.glow*100)+'%';
$('#cWire').checked=P.wire;$('#cGrid').checked=P.grid;$('#cAuto').checked=P.auto;
['cParts','cSpeed','cGlow'].forEach(id=>paintRange($('#'+id)));}

/* boot */
let bootDone=false;
function finishBoot(){if(bootDone)return;bootDone=true;const b=$('#boot');if(b){b.classList.add('done');setTimeout(()=>b.remove(),650);}document.body.classList.add('ready');startCounters();startTyped();}
function runBoot(){if(!$('#boot')){finishBoot();return;}const lines=['DV-OS v0.1 // день ноль','монтаж неоновых шин… ok','подключение ИИ-соавтора… ok','проверка витрины: только живое… ok','очересть замыслов открыта… ok','SYSTEM READY · НАЧИНАЕМ'];
const log=$('#bootLog');let i=0;const iv=setInterval(()=>{if(bootDone){clearInterval(iv);return;}
if(i<lines.length){const d=document.createElement('div');d.textContent='▸ '+lines[i];log.appendChild(d);requestAnimationFrame(()=>d.classList.add('on'));$('#bootBar').style.width=Math.round((i+1)/lines.length*100)+'%';i++;}
else{clearInterval(iv);finishBoot();}},RM?40:165);
$('#boot').addEventListener('click',()=>{clearInterval(iv);finishBoot();});}

/* init */
function init(){
const items='ДЕНЬ 0<b>✦</b>ПУБЛИЧНАЯ СБОРКА<b>✦</b>ТОЛЬКО ЖИВОЕ НА ВИТРИНЕ<b>✦</b>ОЧЕРЕДЬ ОТКРЫТА<b>✦</b>ВАШ СИГНАЛ = СЛЕДУЮЩИЙ БИЛД<b>✦</b>ЧЕЛОВЕК × ИИ<b>✦</b>';
$('#tickerTrack').innerHTML=`<span>${items.repeat(2)}</span><span aria-hidden="true">${items.repeat(2)}</span>`;
$('#contactBox').innerHTML=contactFormHTML();
renderLive();renderQueue();renderLog();palGen();initTerm();initPrioDrag();gfUpdate();syncVoxBtns();
Rain.init();SceneAPI=initScene();
if(!SceneAPI){$('#coreFallback').classList.remove('hide');$('#console').classList.add('off');$$('#console input,#console select,#console button').forEach(el=>el.disabled=true);$('#consoleNote').classList.remove('hide');$('#hudFps').textContent='OFFLINE';}
setPalette(store.get('dv_hue',187));syncConsole();initObservers();updateSoundUI();
$$('input[type=range]').forEach(paintRange);
const tickClock=()=>{const t=new Date().toLocaleTimeString('ru-RU');const a=$('#clock'),b=$('#footClock');if(a)a.textContent=t;if(b)b.textContent=t;};
tickClock();setInterval(tickClock,1000);
requestAnimationFrame(mainLoop);runBoot();}
try{init();window.__dvReady=true;}catch(err){console.error(err);window.__dvReady=false;window.__dvFailsafe();}
