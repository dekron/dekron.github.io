import { ico, rand, randi, store } from './utils.js';

export function createSnake({ openModal, AudioSys, setSnakeApi }) {
function openSnake(){
  openModal(`<div class="snake-hud">
    <div><span class="sh-label">SCORE</span><span class="sh-val" id="snScore">0</span></div>
    <div class="sh-mid">GRID RUNNER<span class="ver">прототип #001 · день 0</span></div>
    <div style="text-align:right"><span class="sh-label">BEST</span><span class="sh-val" id="snBest">0</span></div></div>
  <div class="snake-stage"><canvas id="snCanvas" width="440" height="440"></canvas>
    <div class="snake-ov" id="snStart"><div class="so-title">GRID RUNNER</div><p>Собирай пакеты данных. Не бейся о файрвол и собственный хвост.</p><button class="btn btn-p" data-action="snake-start">${ico('play')}СТАРТ</button><div class="so-hint">WASD / СТРЕЛКИ · СВАЙП · P — ПАУЗА</div></div>
    <div class="snake-ov hide" id="snOver"></div>
    <div class="snake-ov hide" id="snPause"><div class="so-title" style="font-size:22px">ПАУЗА</div><button class="btn btn-s" data-action="snake-pause">${ico('play')}Продолжить</button></div></div>
  <div class="snake-ctl">
    <label class="mini-select">СКОРОСТЬ<select id="snakeSpeed"><option value="140">ЛАЙТ</option><option value="110" selected>НОРМА</option><option value="80">ТУРБО</option></select></label>
    <button class="btn btn-s btn-sm" data-action="snake-pause" id="snPauseBtn">${ico('pause')}Пауза</button>
    <div class="dpad"><button data-dir="up" aria-label="Вверх">▲</button><button data-dir="left" aria-label="Влево">◀</button><span class="dc">DV</span><button data-dir="right" aria-label="Вправо">▶</button><button data-dir="down" aria-label="Вниз">▼</button></div>
  </div>`,{label:'GRID RUNNER',cls:'modal-snake',onOpen:initSnake});
}
function initSnake(back){
  const cv=back.querySelector('#snCanvas'),ctx=cv.getContext('2d'),DPR=Math.min(devicePixelRatio||1,2);
  cv.width=440*DPR;cv.height=440*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
  const N=20,C=22,S=440;
  let snake,dir,queue,food,score,best=store.get('dv_snake_best',0),baseTick=110,tickMs=110,acc=0,last=performance.now();
  let running=false,over=false,paused=false,win=false,particles=[],shake=0,flash=0,raf=0,overTO=0,newBest=false;
  const elScore=back.querySelector('#snScore'),elBest=back.querySelector('#snBest'),ovStart=back.querySelector('#snStart'),ovOver=back.querySelector('#snOver'),ovPause=back.querySelector('#snPause'),pauseBtn=back.querySelector('#snPauseBtn');
  elBest.textContent=best;
  const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  function reset(){snake=[{x:8,y:10},{x:7,y:10},{x:6,y:10}];dir={x:1,y:0};queue=[];score=0;tickMs=baseTick;acc=0;particles=[];shake=0;flash=0;over=false;win=false;newBest=false;placeFood();elScore.textContent='0';}
  function placeFood(){let t=0;do{food={x:randi(0,N-1),y:randi(0,N-1)};t++}while(t<500&&snake.some(s=>s.x===food.x&&s.y===food.y));}
  function pushDir(d){const v=DIRS[d];if(!v)return;const l=queue.length?queue[queue.length-1]:dir;if(v.x===l.x&&v.y===l.y)return;if(queue.length<3)queue.push(v);}
  function start(){if(over)return;running=true;paused=false;ovStart.classList.add('hide');ovPause.classList.add('hide');last=performance.now();acc=0;AudioSys.sfx('click');}
  function restart(){reset();running=true;paused=false;ovOver.classList.add('hide');ovStart.classList.add('hide');ovPause.classList.add('hide');last=performance.now();AudioSys.sfx('click');}
  function pauseToggle(){if(!running||over)return;paused=!paused;ovPause.classList.toggle('hide',!paused);pauseBtn.innerHTML=(paused?ico('play'):ico('pause'))+(paused?'Дальше':'Пауза');AudioSys.sfx('toggle');}
  function die(w){over=true;win=!!w;running=false;shake=w?4:11;flash=1;AudioSys.sfx(w?'ok':'die');
    if(score>best){best=score;store.set('dv_snake_best',best);elBest.textContent=best;newBest=true;}
    overTO=setTimeout(()=>{ovOver.innerHTML=`<div class="so-title" style="font-size:22px;color:${win?'var(--ok)':'var(--err)'}">${win?'СЕТЬ ЗАХВАЧЕНА':'СИГНАЛ ПОТЕРЯН'}</div><div class="so-score">${score}</div>${newBest?'<span class="so-new">★ НОВЫЙ РЕКОРД</span>':`<p>Рекорд: ${best}</p>`}<button class="btn btn-p" data-action="snake-restart">${ico('reset')}Заново</button><div class="so-hint">ENTER — РЕСТАРТ</div>`;ovOver.classList.remove('hide');},480);}
  function step(){if(queue.length){const d=queue.shift();if(!(d.x===-dir.x&&d.y===-dir.y))dir=d;}
    const hx=snake[0].x+dir.x,hy=snake[0].y+dir.y;
    if(hx<0||hy<0||hx>=N||hy>=N||snake.some(s=>s.x===hx&&s.y===hy)){die(false);return;}
    snake.unshift({x:hx,y:hy});
    if(hx===food.x&&hy===food.y){score++;elScore.textContent=score;AudioSys.sfx('eat');
      for(let i=0;i<12;i++)particles.push({x:food.x*C+C/2,y:food.y*C+C/2,vx:rand(-2.4,2.4),vy:rand(-2.4,2.4),l:1,h:rand(30,55)});
      if(snake.length>=N*N){die(true);return;}
      if(score%5===0)tickMs=Math.max(baseTick-32,tickMs-6);placeFood();}else snake.pop();}
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function draw(t){ctx.save();ctx.clearRect(0,0,S,S);ctx.fillStyle='#060913';ctx.fillRect(0,0,S,S);
    if(shake>0){ctx.translate(rand(-shake,shake)*.5,rand(-shake,shake)*.5);shake*=.86;if(shake<.3)shake=0;}
    ctx.strokeStyle='rgba(0,240,255,.07)';ctx.lineWidth=1;ctx.beginPath();
    for(let i=1;i<N;i++){ctx.moveTo(i*C,0);ctx.lineTo(i*C,S);ctx.moveTo(0,i*C);ctx.lineTo(S,i*C);}ctx.stroke();
    ctx.strokeStyle=`rgba(255,51,85,${.3+flash*.6})`;ctx.lineWidth=2;ctx.strokeRect(1,1,S-2,S-2);
    const fx=food.x*C+C/2,fy=food.y*C+C/2,pu=1+Math.sin(t*.006)*.18;
    ctx.save();ctx.translate(fx,fy);ctx.rotate(t*.002);ctx.shadowColor='#ffc233';ctx.shadowBlur=14;ctx.fillStyle='#ffc233';ctx.fillRect(-6*pu,-6*pu,12*pu,12*pu);ctx.restore();
    const len=snake.length;
    for(let i=len-1;i>=0;i--){const s=snake[i],hue=187+(311-187)*(i/Math.max(1,len-1));
      ctx.fillStyle=`hsl(${hue},100%,${62-(i/len)*14}%)`;if(i===0){ctx.shadowColor='#00f0ff';ctx.shadowBlur=13;}else ctx.shadowBlur=0;
      rr(s.x*C+2,s.y*C+2,C-4,C-4,i===0?7:5);ctx.fill();}
    ctx.shadowBlur=0;const hd=snake[0];ctx.fillStyle='#04121a';
    const ex=hd.x*C+C/2+dir.x*4,ey=hd.y*C+C/2+dir.y*4;
    ctx.beginPath();ctx.arc(ex+(dir.y?3.5:0),ey+(dir.x?3.5:0),2,0,7);ctx.arc(ex-(dir.y?3.5:0),ey-(dir.x?3.5:0),2,0,7);ctx.fill();
    if(particles.length){ctx.globalCompositeOperation='lighter';
      particles=particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.94;p.vy*=.94;p.l-=.045;if(p.l<=0)return false;ctx.fillStyle=`hsla(${p.h},100%,60%,${p.l})`;ctx.fillRect(p.x-2,p.y-2,4,4);return true;});
      ctx.globalCompositeOperation='source-over';}
    if(flash>0){ctx.fillStyle=`rgba(255,51,85,${flash*.28})`;ctx.fillRect(0,0,S,S);flash*=.9;if(flash<.02)flash=0;}
    ctx.restore();}
  function loop(t){raf=requestAnimationFrame(loop);const dt=Math.min(60,t-last);last=t;
    if(running&&!paused&&!document.hidden){acc+=dt;while(acc>=tickMs){step();acc-=tickMs;if(over)break;}}draw(t);}
  reset();raf=requestAnimationFrame(loop);
  const keys=e=>{const m={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
    if(m[e.code]){e.preventDefault();if(!running&&!over)start();pushDir(m[e.code]);return;}
    if(e.code==='Space'||e.code==='KeyP'){e.preventDefault();if(!running&&!over)start();else pauseToggle();return;}
    if(e.code==='Enter'){if(over)restart();else if(!running)start();}};
  window.addEventListener('keydown',keys);
  const vis=()=>{if(document.hidden&&running&&!paused)pauseToggle();};
  document.addEventListener('visibilitychange',vis);
  let sw=null;
  cv.addEventListener('pointerdown',e=>{sw={x:e.clientX,y:e.clientY};});
  cv.addEventListener('pointerup',e=>{if(!sw)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y;sw=null;
    if(Math.abs(dx)<20&&Math.abs(dy)<20){if(!running&&!over)start();return;}
    if(!running&&!over)start();pushDir(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));});
  back.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>{if(over)return;if(!running)start();pushDir(b.dataset.dir);}));
  setSnakeApi({start,restart,pauseToggle,setSpeed:v=>{baseTick=+v;tickMs=+v;}});
  return()=>{cancelAnimationFrame(raf);clearTimeout(overTO);window.removeEventListener('keydown',keys);document.removeEventListener('visibilitychange',vis);setSnakeApi(null);};
}

return openSnake;
}
