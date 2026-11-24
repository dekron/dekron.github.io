(() => {
'use strict';
const { createAudio, THEMES, LEVELS, LV_ICONS, LV_GRADS, drawCat } = window.Ginger;

/* ============================================================
   РЫЖИК — приключение котика
   ============================================================ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
const TAU=Math.PI*2;
const T=48, GRAV=2300, MOVE=275, JUMP=730, SPRINGV=1080, MAXFALL=980;
const STEP=1/120;

/* ---------------- save ---------------- */
let save={u:1,s:[0,0,0,0,0,0,0,0],f:[0,0,0,0,0,0,0,0],snd:1};
try{const raw=localStorage.getItem('ryzhik_v1'); if(raw){const p=JSON.parse(raw); if(p&&p.s&&p.s.length===8) save=Object.assign(save,p);}}catch(e){}
function persist(){try{localStorage.setItem('ryzhik_v1',JSON.stringify(save));}catch(e){}}

/* ---------------- canvas ---------------- */
const cv=$('cv'), ctx=cv.getContext('2d',{alpha:false});
let DPR=1, CW=0, CH=0, S=1, VW=0, VH=0;
function sizeCanvas(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  CW=window.innerWidth; CH=window.innerHeight;
  cv.width=Math.round(CW*DPR); cv.height=Math.round(CH*DPR);
  S=Math.min(CH/560, CW/820); VW=CW/S; VH=CH/S;
}
window.addEventListener('resize',sizeCanvas);
window.addEventListener('orientationchange',sizeCanvas);
sizeCanvas();
if(matchMedia('(pointer: coarse)').matches||'ontouchstart' in window) document.body.classList.add('touch');

const audio=createAudio({ getSave:()=>save, persist, $, clamp });
const { initAudio, meow, purr, SFX, setMuted }=audio;

/* ---------------- game state ---------------- */
const G={state:'title',level:0,lives:9,fish:0,deaths:0,time:0};
let W=null, P=null, cam={x:0,y:0,snap(){this.x=clamp(P.x,0,1e9);this.y=P.y-40;clampCam(true);}};
let particles=[], floaters=[], ambient=[], rain=[], demoParts=[];
let shake=0, hitstop=0, respawnT=0, respawnDone=false, hurtFlash=0, lightningA=0, lightningT=rnd(6,12);
let clearT=0, objTimer=0, tNow=0, winConfettiT=0, shootStar=null, shootT=rnd(5,10);
const demoCat={x:0,y:0,dir:1,grounded:true,vx:0,vy:0,sx:1,sy:1,phase:0,blink:0,blinkT:2,inv:0,happy:0,w:34,h:30,pet:0};

/* ---------------- input ---------------- */
const input={l:false,r:false,jumpHeld:false,jbuf:0};
let keyL=false,keyR=false,tL=false,tR=false,tJ=false,keyJ=false;
function syncInput(){input.l=keyL||tL;input.r=keyR||tR;input.jumpHeld=keyJ||tJ;}
window.addEventListener('keydown',e=>{
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
  initAudio();
  if(e.repeat)return;
  const st=G.state;
  if((e.code==='Space'||e.code==='Enter')&&st!=='play'&&st!=='levels'){primaryAction();return;}
  if(e.code==='ArrowLeft'||e.code==='KeyA'){keyL=true;syncInput();}
  if(e.code==='ArrowRight'||e.code==='KeyD'){keyR=true;syncInput();}
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){keyJ=true;syncInput();if(st==='play')input.jbuf=.13;}
  if(e.code==='KeyM'){catMeow();}
  if(e.code==='KeyR'&&(st==='play'||st==='pause')){SFX.click();retryLevel();}
  if((e.code==='KeyP'||e.code==='Escape')){ if(st==='play')pauseGame(); else if(st==='pause')resumeGame(); }
});
window.addEventListener('keyup',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA'){keyL=false;syncInput();}
  if(e.code==='ArrowRight'||e.code==='KeyD'){keyR=false;syncInput();}
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){keyJ=false;syncInput();}
});
function bindTouch(id,set){
  const el=$(id); const ids=new Set();
  el.addEventListener('pointerdown',e=>{e.preventDefault();initAudio();ids.add(e.pointerId);el.classList.add('press');set(true);
    if(id==='tJump'&&G.state==='play')input.jbuf=.13;});
  const off=e=>{ids.delete(e.pointerId);if(!ids.size){el.classList.remove('press');set(false);}};
  el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('pointerleave',off);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
bindTouch('tLeft',v=>{tL=v;syncInput();});
bindTouch('tRight',v=>{tR=v;syncInput();});
bindTouch('tJump',v=>{tJ=v;syncInput();});
window.addEventListener('pointerdown',()=>initAudio(),{passive:true});
cv.addEventListener('pointerdown',e=>{
  if(G.state==='title'||G.state==='levels'||G.state==='win'){
    const x=e.clientX/S,y=e.clientY/S;
    if(Math.hypot(x-demoCat.x,y-(demoCat.y-20))<95){
      demoCat.pet=1;demoCat.happy=1.4;meow('happy');purr();
      for(let i=0;i<7;i++)demoParts.push({x:demoCat.x+rnd(-24,24),y:demoCat.y-40,vx:rnd(-30,30),vy:rnd(-90,-40),life:rnd(.8,1.3),max:1.3,type:'heart'});
    }
  }
});
function catMeow(){
  if(G.state==='play'&&P&&!P.dead){meow('mew');addFloater(P.x,P.y-46,'мяу!','#ffc93c');
    for(let i=0;i<3;i++)spawnP(P.x+rnd(-14,14),P.y-40,'heart',rnd(-20,20),rnd(-70,-30));}
  else{meow('happy');demoCat.happy=1.2;}
}

/* ---------------- world build ---------------- */
function loadLevel(idx){
  const def=LEVELS[idx]; const H=14, w=def.w;
  const grid=Array.from({length:H},()=>Array(w).fill('.'));
  const b={rect(x0,x1,y0,y1,c){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(grid[y]&&x>=0&&x<w)grid[y][x]=c;},
           set(x,y,c){if(grid[y]&&x>=0&&x<w)grid[y][x]=c;}};
  def.build(b);
  W={idx,def,w,h:H,grid,theme:THEMES[def.theme],mt:0,
     fish:[],yarns:[],springs:[],movers:[],enemies:[],checks:[],goal:null,spawn:{x:100,y:100},cp:null,bg:null};
  for(let y=0;y<H;y++)for(let x=0;x<w;x++){
    const c=grid[y][x], cx=(x+.5)*T, cy=(y+.5)*T;
    if(c==='f'){W.fish.push({x:cx,y:cy,got:false,ph:rnd(TAU)});grid[y][x]='.';}
    else if(c==='y'){W.yarns.push({x:cx,y:cy,got:false,ph:rnd(TAU)});grid[y][x]='.';}
    else if(c==='S'){W.springs.push({x:cx,top:(y+1)*T-14,ground:(y+1)*T,c:0,cd:0});grid[y][x]='.';}
    else if(c==='m'||c==='v'||c==='V'){
      W.movers.push({bx:x*T,by:y*T,x:x*T,y:y*T,px:x*T,py:y*T,dx:0,dy:0,w:96,h:16,
        axis:c==='m'?'x':'y',amp:(c==='V'?3:2)*T,sp:c==='m'?1.9:2.2,ph:rnd(TAU)});grid[y][x]='.';}
    else if(c==='D'||c==='R'){
      const dog=c==='D', h=dog?30:20;
      W.enemies.push({type:dog?'dog':'vac',x:cx,y:(y+1)*T-h/2,sx:cx,w:dog?46:46,h,dir:Math.random()<.5?-1:1,
        sp:dog?62:95,alive:true,deadT:0,anim:rnd(TAU)});grid[y][x]='.';}
    else if(c==='K'){W.checks.push({x:cx,ground:(y+1)*T,active:false,rise:0});grid[y][x]='.';}
    else if(c==='P'){W.spawn={x:cx,y:(y+1)*T-15};grid[y][x]='.';}
    else if(c==='G'){W.goal={x:cx,ground:(y+1)*T,final:idx===7};grid[y][x]='.';}
  }
  W.cp={x:W.spawn.x,y:W.spawn.y};
  P={x:W.spawn.x,y:W.spawn.y,w:34,h:30,vx:0,vy:0,dir:1,grounded:false,coyote:0,riding:null,jumpCutEligible:false,
     inv:0,sx:1,sy:1,phase:0,blink:0,blinkT:rnd(1,3),prevY:0,dustT:0,dead:false,deadT:0,rot:0,clearing:false,happy:0,pet:0};
  G.lives=9;G.fish=0;G.deaths=0;G.time=0;
  particles.length=0;floaters.length=0;ambient.length=0;rain.length=0;
  shake=0;hitstop=0;respawnT=0;hurtFlash=0;lightningA=0;lightningT=rnd(6,12);clearT=0;
  buildBG();
  cam.x=P.x;cam.y=P.y-40;clampCam(true);
  updateHUD();
  showObjective(idx===0?'Собери <b>3 рыбки</b> и дойди до корзинки →':'Собери <b>3 рыбки</b> и найди корзинку',7);
}
function solidAt(px,py){
  const tx=Math.floor(px/T),ty=Math.floor(py/T);
  if(tx<0||tx>=W.w)return true; if(ty<0||ty>=W.h)return false;
  return W.grid[ty][tx]==='#';
}
function clampCam(snap){
  const lw=W.w*T, lh=W.h*T;
  let minX=VW/2,maxX=lw-VW/2, minY=VH/2-160, maxY=lh-VH/2+60;
  cam.x = maxX<minX ? lw/2 : clamp(cam.x,minX,maxX);
  cam.y = maxY<minY ? lh/2-40 : clamp(cam.y,minY,maxY);
}

/* ---------------- particles / floaters ---------------- */
function spawnP(x,y,type,vx=0,vy=0,extra){
  if(particles.length>460)particles.shift();
  const p={x,y,vx,vy,type,life:1,max:1,rot:rnd(TAU),vr:rnd(-6,6),size:1,col:null};
  switch(type){
    case 'dust':p.max=p.life=rnd(.3,.55);p.size=rnd(3,6);p.col='rgba(220,200,220,';break;
    case 'poof':p.max=p.life=rnd(.35,.6);p.size=rnd(6,12);p.col='rgba(255,244,230,';break;
    case 'spark':p.max=p.life=rnd(.4,.8);p.size=rnd(2,4);p.col='#ffc93c';p.vy+=rnd(-60,60);break;
    case 'drop':p.max=p.life=rnd(.4,.7);p.size=rnd(2,4);p.col='#4cc9f0';break;
    case 'confetti':p.max=p.life=rnd(1,1.7);p.size=rnd(4,7);
      p.col=['#ffc93c','#ff5470','#3ddc97','#4cc9f0','#ff70a6','#ffb347'][Math.floor(rnd(6))];break;
    case 'heart':p.max=p.life=rnd(.8,1.2);p.size=rnd(5,8);p.col='#ff70a6';break;
    case 'sparkle':p.max=p.life=rnd(.5,.9);p.size=rnd(3,5);p.col='#ffe9a0';break;
    case 'petal':p.max=p.life=rnd(2,3.5);p.size=rnd(3,5);p.col='#ff9fb0';break;
  }
  if(extra)Object.assign(p,extra);
  particles.push(p);
}
function burst(x,y,type,n,pow=160){
  for(let i=0;i<n;i++){const a=rnd(TAU),v=rnd(pow*.3,pow);spawnP(x,y,type,Math.cos(a)*v,Math.sin(a)*v-pow*.4);}
}
function addFloater(x,y,txt,col='#fff4e6'){floaters.push({x,y,txt,col,life:1});}
function addShake(m){shake=Math.min(18,shake+m);}
function stop(ms){hitstop=Math.max(hitstop,ms/1000);}

/* ---------------- gameplay update ---------------- */
function updatePlay(dt){
  if(!W||!P)return;
  if(hitstop>0){hitstop-=dt;return;}
  // movers
  W.mt+=dt;
  for(const m of W.movers){
    m.px=m.x;m.py=m.y;
    const off=Math.sin(W.mt*m.sp+m.ph)*m.amp;
    if(m.axis==='x'){m.x=m.bx+off;}else{m.y=m.by+off;}
    m.dx=m.x-m.px;m.dy=m.y-m.py;
  }
  if(respawnT>0){respawnT-=dt;
    if(!respawnDone&&respawnT<.24){respawnDone=true;
      P.x=W.cp.x;P.y=W.cp.y;P.vx=0;P.vy=0;P.riding=null;P.jumpCutEligible=false;P.inv=2;cam.x=P.x;cam.y=P.y-40;clampCam(true);}
    return;}
  if(P.dead){P.deadT-=dt;P.vy+=GRAV*dt;P.y+=P.vy*dt;P.rot+=dt*7;
    if(P.deadT<=0)showOver();return;}
  if(!P.clearing)G.time+=dt;
  // ride mover
  if(P.riding){const m=P.riding;
    if(P.vy<0||P.x+P.w/2<m.x||P.x-P.w/2>m.x+m.w||Math.abs(P.y+P.h/2-m.y)>10)P.riding=null;
    else{P.x+=m.dx;P.y+=m.dy;}}
  // horizontal
  const want=(P.clearing?0:(input.r?1:0)-(input.l?1:0))*MOVE;
  const acc=P.grounded?2600:1700;
  if(want!==0){P.vx+=clamp(want-P.vx,-acc*dt,acc*dt);P.dir=want>0?1:-1;}
  else{const dec=P.grounded?2400:400;P.vx+=clamp(-P.vx,-dec*dt,dec*dt);}
  // timers
  P.coyote-=dt;input.jbuf-=dt;P.inv-=dt;
  if(P.grounded)P.coyote=.1;
  // jump
  if(input.jbuf>0&&(P.grounded||P.coyote>0)&&!P.clearing){
    input.jbuf=0;P.coyote=0;P.vy=-JUMP;P.grounded=false;P.riding=null;P.jumpCutEligible=true;
    P.sy=1.16;P.sx=.88;meow('mew');
    for(let i=0;i<5;i++)spawnP(P.x+rnd(-10,10),P.y+14,'dust',rnd(-50,50),rnd(-20,10));
  }
  if(P.jumpCutEligible&&!input.jumpHeld&&P.vy<-260){P.vy=-260;P.jumpCutEligible=false;}
  if(P.vy>=0)P.jumpCutEligible=false; // Springs and enemy bounces are not shortened.
  // gravity
  P.vy=Math.min(P.vy+GRAV*dt,MAXFALL);
  const hw=P.w/2,hh=P.h/2,prevBottom=P.y+hh,wasGrounded=P.grounded,prevVy=P.vy;
  // move X
  P.x+=P.vx*dt;
  if(P.vx>0){const e=P.x+hw;
    if(solidAt(e,P.y-hh+3)||solidAt(e,P.y)||solidAt(e,P.y+hh-3)){P.x=Math.floor(e/T)*T-hw-.01;P.vx=0;}}
  else if(P.vx<0){const e=P.x-hw;
    if(solidAt(e,P.y-hh+3)||solidAt(e,P.y)||solidAt(e,P.y+hh-3)){P.x=(Math.floor(e/T)+1)*T+hw+.01;P.vx=0;}}
  P.x=clamp(P.x,hw,W.w*T-hw);
  // move Y
  P.y+=P.vy*dt;P.grounded=false;
  if(P.vy>0){const e=P.y+hh;
    if(solidAt(P.x-hw+4,e)||solidAt(P.x+hw-4,e)){P.y=Math.floor(e/T)*T-hh-.01;P.vy=0;P.grounded=true;}}
  else if(P.vy<0){const e=P.y-hh;
    if(solidAt(P.x-hw+4,e)||solidAt(P.x+hw-4,e)){P.y=(Math.floor(e/T)+1)*T+hh+.01;P.vy=0;SFX.bonk();}}
  // movers landing
  if(P.vy>=0)for(const m of W.movers){
    if(prevBottom<=m.py+6&&P.y+hh>=m.y&&P.y+hh<=m.y+m.h+16&&P.x+hw>m.x&&P.x-hw<m.x+m.w){
      P.y=m.y-hh;P.vy=0;P.grounded=true;P.riding=m;}}
  // springs
  for(const s of W.springs){s.cd-=dt;
    if(s.cd<=0&&Math.abs(P.x-s.x)<26&&P.y+hh>s.top-4&&P.y+hh<s.ground+8&&P.vy>=-40){
      P.y=s.top-hh-1;P.vy=-SPRINGV;P.grounded=false;P.riding=null;P.coyote=0;P.jumpCutEligible=false;s.c=1;s.cd=.25;
      P.sy=1.3;P.sx=.75;SFX.spring();addShake(3);
      burst(s.x,s.top,'poof',6,90);addFloater(s.x,s.top-26,'прыг!','#ff8fa3');}}
  // landing
  if(!wasGrounded&&P.grounded){
    if(prevVy>420){P.sy=.8;P.sx=1.2;SFX.thud();addShake(prevVy>800?3:1.2);
      for(let i=0;i<7;i++)spawnP(P.x+rnd(-14,14),P.y+hh,'dust',rnd(-80,80),rnd(-40,-5));}
    else{P.sy=.9;P.sx=1.08;}}
  // run dust & phase
  if(P.grounded&&Math.abs(P.vx)>40){P.phase+=Math.abs(P.vx)*dt*.055;P.dustT-=dt;
    if(P.dustT<=0){P.dustT=.14;spawnP(P.x-P.dir*14,P.y+hh-2,'dust',-P.dir*rnd(20,60),rnd(-30,-5));}}
  // enemies
  for(const e of W.enemies){
    if(!e.alive){e.deadT-=dt;continue;}
    e.anim+=dt;e.x+=e.dir*e.sp*dt;
    const ahead=e.x+e.dir*(e.w/2+5);
    if(Math.abs(e.x-e.sx)>5*T||solidAt(ahead,e.y)||!solidAt(ahead,e.y+e.h/2+8))
      {e.dir*=-1;e.x+=e.dir*e.sp*dt*2;}
    if(e.type==='vac'&&Math.random()<dt*6)spawnP(e.x-e.dir*20,e.y+e.h/2-4,'dust',-e.dir*30,rnd(-20,0));
    // collide with player
    if(!P.clearing&&Math.abs(P.x-e.x)<(P.w+e.w)/2-4&&Math.abs(P.y-e.y)<(P.h+e.h)/2-2){
      if(P.vy>140&&prevBottom<=e.y-e.h/2+12){
        e.alive=false;e.deadT=.5;P.vy=input.jumpHeld?-560:-440;P.jumpCutEligible=false;P.sy=1.2;P.sx=.85;
        stop(60);addShake(5);burst(e.x,e.y,'poof',10,150);SFX.stomp();
        if(e.type==='dog'){SFX.woof();addFloater(e.x,e.y-24,'бонк!','#ffc93c');}
        else{SFX.spark();burst(e.x,e.y-6,'spark',10,180);addFloater(e.x,e.y-24,'пшш!','#4cc9f0');}
      }else hurtByEnemy(e);
    }
  }
  // hazards
  if(!P.clearing&&P.inv<=0){
    const x0=Math.floor((P.x-hw+5)/T),x1=Math.floor((P.x+hw-5)/T),
          y0=Math.floor((P.y-hh+4)/T),y1=Math.floor((P.y+hh-2)/T);
    outer:for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      if(ty<0||ty>=W.h||tx<0||tx>=W.w)continue;
      const c=W.grid[ty][tx];
      if(c==='^'&&P.y+hh-2>ty*T+22){hazardHit('spike');break outer;}
      if(c==='~'&&P.y+hh>ty*T+18){hazardHit('water');break outer;}
    }
    if(P.y-hh>W.h*T+140)hazardHit('fall');
  }
  // fish
  for(const f of W.fish){if(f.got)continue;
    if(Math.hypot(P.x-f.x,P.y-f.y)<36){f.got=true;G.fish++;SFX.fish();
      burst(f.x,f.y,'spark',12,170);burst(f.x,f.y,'sparkle',5,90);
      addFloater(f.x,f.y-20,'+рыбка','#ffc93c');updateHUD();bump('chipFish');
      if(G.fish===3){SFX.allfish();addFloater(P.x,P.y-52,'все рыбки! ★','#3ddc97');
        showObjective('Все рыбки! Теперь <b>к корзинке</b> →',5);}}}
  // yarn
  for(const y of W.yarns){if(y.got)continue;
    if(Math.hypot(P.x-y.x,P.y-y.y)<34){y.got=true;
      if(G.lives<9){G.lives++;addFloater(y.x,y.y-20,'+1 жизнь','#ff70a6');}
      else addFloater(y.x,y.y-20,'мур~','#ff70a6');
      SFX.yarn();burst(y.x,y.y,'heart',6,110);updateHUD();bump('chipLives');}}
  // checkpoints
  for(const k of W.checks){if(k.active)continue;
    if(Math.abs(P.x-k.x)<34&&Math.abs(P.y+hh-k.ground)<60){
      k.active=true;W.cp={x:k.x,y:k.ground-15};SFX.check();meow('mew');
      burst(k.x,k.ground-40,'sparkle',8,110);addFloater(k.x,k.ground-64,'мяу! точка ✓','#3ddc97');}}
  // goal
  const g=W.goal;
  // The basket can only be reached at its own height, never through the platform below.
  if(!P.clearing&&g&&Math.abs(P.x-g.x)<44&&P.y+hh>g.ground-72&&P.y+hh<=g.ground+4){
    P.clearing=true;clearT=1.05;P.vy=-430;P.vx=0;P.happy=2;
    SFX.jingle();addShake(3);stop(50);
    burst(g.x,g.ground-40,'confetti',44,260);burst(g.x,g.ground-40,'sparkle',12,150);
    addFloater(g.x,g.ground-80,'мяу-у!','#ffc93c');
    const stars=1+(G.fish===3?1:0)+(G.deaths===0?1:0);
    save.s[G.level]=Math.max(save.s[G.level],stars);
    save.f[G.level]=Math.max(save.f[G.level],G.fish);
    save.u=Math.max(save.u,Math.min(8,G.level+2));persist();
  }
  if(P.clearing){clearT-=dt;if(clearT<=0)showClear();}
}
function loseLife(){
  G.lives--;G.deaths++;updateHUD();bump('chipLives');
  $('chipLives').classList.toggle('low',G.lives<=3);
  return G.lives<=0;
}
function hurtByEnemy(e){
  if(P.inv>0)return;
  P.inv=1.6;P.vx=(P.x<e.x?-1:1)*320;P.vy=-380;P.grounded=false;P.riding=null;
  addShake(8);stop(70);hurtFlash=.3;meow('hurt');addFloater(P.x,P.y-40,'ай!','#ff5470');
  burst(P.x,P.y,'poof',6,120);
  if(loseLife())die();
}
function hazardHit(kind){
  if(P.inv>0&&kind!=='fall')return;
  hurtFlash=.35;addShake(7);meow('hurt');
  if(kind==='water'){burst(P.x,P.y+10,'drop',16,220);addFloater(P.x,P.y-36,'бултых!','#4cc9f0');}
  else if(kind==='spike'){burst(P.x,P.y+10,'poof',8,150);addFloater(P.x,P.y-36,'ой!','#ff5470');}
  else addFloater(P.x,P.y-36,'упс!','#ff5470');
  if(loseLife()){die();return;}
  respawnT=.5;respawnDone=false;
}
function die(){
  P.dead=true;P.deadT=1.0;P.vy=-520;P.rot=0;SFX.death();addShake(10);
}

/* ---------------- fx update (always) ---------------- */
function updateFx(dt){
  tNow+=dt;
  shake*=Math.exp(-dt*7);if(shake<.05)shake=0;
  hurtFlash=Math.max(0,hurtFlash-dt*1.4);
  lightningA*=Math.exp(-dt*5);
  // camera
  if(W&&P&&['intro','play','pause','clear','over'].includes(G.state)){
    const tx=P.x+P.dir*60,ty=P.y-40,k=1-Math.exp(-dt*6);
    cam.x=lerp(cam.x,tx,k);cam.y=lerp(cam.y,ty,k*.8);clampCam();
  }
  // player cosmetics
  if(P){
    P.sx+=(1-P.sx)*Math.min(1,dt*10);P.sy+=(1-P.sy)*Math.min(1,dt*10);
    P.blinkT-=dt;if(P.blinkT<=0){P.blink=.13;P.blinkT=rnd(1.6,4);}
    P.blink=Math.max(0,P.blink-dt);P.happy=Math.max(0,P.happy-dt);
  }
  demoCat.blinkT-=dt;if(demoCat.blinkT<=0){demoCat.blink=.13;demoCat.blinkT=rnd(1.6,4);}
  demoCat.blink=Math.max(0,demoCat.blink-dt);demoCat.happy=Math.max(0,demoCat.happy-dt);
  demoCat.pet=Math.max(0,demoCat.pet-dt);
  // springs / checkpoints anim
  if(W){for(const s of W.springs)s.c=Math.max(0,s.c-dt*4);
    for(const k of W.checks)if(k.active)k.rise=Math.min(1,k.rise+dt*3);}
  // particles
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;
    if(p.life<=0){particles.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
    if(p.type==='confetti'){p.vy+=560*dt;p.vx*=Math.exp(-dt*1.2);}
    else if(p.type==='drop')p.vy+=900*dt;
    else if(p.type==='heart'||p.type==='sparkle')p.vy-=30*dt;
    else if(p.type==='petal'){p.vy+=40*dt;p.vx+=Math.sin(tNow*2+p.rot)*20*dt;}
    else{p.vx*=Math.exp(-dt*3);p.vy*=Math.exp(-dt*3);}
  }
  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.life-=dt*.9;f.y-=44*dt;
    if(f.life<=0)floaters.splice(i,1);}
  for(let i=demoParts.length-1;i>=0;i--){const p=demoParts[i];p.life-=dt;
    if(p.life<=0){demoParts.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=20*dt;}
  // ambient per theme
  const th=W&&['intro','play','pause','clear','over'].includes(G.state)?W.theme:THEMES.roof;
  const inWorld=th===W?.theme&&W;
  if(th.amb==='firefly'&&ambient.length<26&&Math.random()<dt*8){
    const x=inWorld?cam.x+rnd(-VW/2,VW/2):rnd(VW),y=inWorld?cam.y+rnd(-VH/3,VH/3):rnd(VH*.7);
    ambient.push({x,y,type:'firefly',ph:rnd(TAU),life:rnd(4,9),max:9});}
  if(th.amb==='mote'&&ambient.length<30&&Math.random()<dt*10){
    const x=inWorld?cam.x+rnd(-VW/2,VW/2):rnd(VW),y=inWorld?cam.y+rnd(-VH/2,VH/2):rnd(VH);
    ambient.push({x,y,type:'mote',ph:rnd(TAU),life:rnd(4,8),max:8});}
  if(th.amb==='petal'&&inWorld&&ambient.length<20&&Math.random()<dt*5)
    ambient.push({x:cam.x+rnd(-VW/2,VW/2),y:cam.y-VH/2-20,type:'petal',ph:rnd(TAU),life:7,max:7});
  for(let i=ambient.length-1;i>=0;i--){const a=ambient[i];a.life-=dt;a.ph+=dt;
    if(a.type==='firefly'){a.x+=Math.sin(a.ph*.9)*22*dt;a.y+=Math.cos(a.ph*.7)*16*dt;}
    else if(a.type==='mote'){a.x+=8*dt;a.y+=Math.sin(a.ph)*6*dt;}
    else if(a.type==='petal'){a.y+=46*dt;a.x+=Math.sin(a.ph*2)*30*dt;}
    if(a.life<=0)ambient.splice(i,1);}
  // rain
  if(th.amb==='rain'){
    for(let i=0;i<7;i++)if(rain.length<130)rain.push({x:rnd(-40,VW+40),y:rnd(-VH*.2,0),v:rnd(760,980)});
    for(let i=rain.length-1;i>=0;i--){const r=rain[i];r.y+=r.v*dt;r.x-=r.v*.14*dt;
      if(r.y>VH+20)rain.splice(i,1);}
    if(G.state==='play'){lightningT-=dt;
      if(lightningT<=0){lightningT=rnd(7,14);lightningA=.55;SFX.thunder();}}
  } else rain.length=0;
  // shooting star
  if((th===THEMES.roof||th===THEMES.tower)&&!shootStar){shootT-=dt;
    if(shootT<=0){shootT=rnd(7,14);shootStar={x:rnd(VW*.2,VW*.8),y:rnd(30,VH*.25),t:0};}}
  if(shootStar){shootStar.t+=dt;shootStar.x+=460*dt;shootStar.y+=170*dt;
    if(shootStar.t>.8)shootStar=null;}
  // objective fade
  if(objTimer>0){objTimer-=dt;if(objTimer<=0)$('objective').classList.remove('show');}
  // win confetti
  if(G.state==='win'){winConfettiT-=dt;
    if(winConfettiT<=0&&W){winConfettiT=.35;
      burst(cam.x+rnd(-VW/3,VW/3),cam.y-VH/2+30,'confetti',10,180);}}
}
function showObjective(html,dur){$('objective').innerHTML=html;$('objective').classList.add('show');objTimer=dur;}
function bump(id){const el=$(id);el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
function updateHUD(){
  $('hudLevel').textContent=(G.level+1)+' · '+LEVELS[G.level].name;
  $('hudFish').textContent=G.fish+'/3';
  $('hudLives').textContent='×'+G.lives;
}

/* ============================================================
   RENDER
   ============================================================ */
let glowGold=null,glowMint=null,glowRed=null,fishSprite=null;
function makeGlow(col){
  const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
  const gr=g.createRadialGradient(48,48,2,48,48,46);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr;g.fillRect(0,0,96,96);return c;
}
function makeFish(){
  const c=document.createElement('canvas');c.width=c.height=72;const g=c.getContext('2d');
  g.drawImage(makeGlow('rgba(255,201,60,.5)'),0,0,72,72);
  g.translate(36,36);
  const bg=g.createLinearGradient(-14,-8,14,8);bg.addColorStop(0,'#ffd76b');bg.addColorStop(1,'#ff9f45');
  g.fillStyle=bg;
  g.beginPath();g.moveTo(-12,0);g.quadraticCurveTo(-4,-9,6,-7);g.quadraticCurveTo(14,-5,15,0);
  g.quadraticCurveTo(14,5,6,7);g.quadraticCurveTo(-4,9,-12,0);g.closePath();g.fill();
  g.beginPath();g.moveTo(-11,0);g.lineTo(-19,-7);g.lineTo(-17,0);g.lineTo(-19,7);g.closePath();g.fill();
  g.fillStyle='#e2762b';g.beginPath();g.moveTo(0,-7);g.quadraticCurveTo(4,-12,8,-7);g.closePath();g.fill();
  g.strokeStyle='rgba(180,90,20,.5)';g.lineWidth=1.4;g.beginPath();g.arc(5,0,4,-.9,.9);g.stroke();
  g.fillStyle='#2a1030';g.beginPath();g.arc(10,-2,1.7,0,TAU);g.fill();
  g.fillStyle='#fff';g.beginPath();g.arc(10.6,-2.6,.6,0,TAU);g.fill();
  return c;
}
glowGold=makeGlow('rgba(255,201,60,.55)');glowMint=makeGlow('rgba(61,220,151,.5)');glowRed=makeGlow('rgba(255,84,112,.6)');
fishSprite=makeFish();
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function hash(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295;}

/* ---------- background ---------- */
let bgStars=[],bgFar=[],bgMid=[];
function buildBG(){
  const th=W.theme;let seed=W.idx*997+13;
  const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  bgStars=[];for(let i=0;i<90;i++)bgStars.push({x:R()*2200,y:R()*380,s:R()*1.6+.5,p:R()*TAU});
  bgFar=[];let x=0;while(x<2600){const w=60+R()*130,h=90+R()*190;bgFar.push({x,w,h,r:R()});x+=w+R()*50+10;}
  bgMid=[];x=0;while(x<2000){bgMid.push({x,r:R(),r2:R()});x+=110+R()*140;}
}
function drawBG(th,camX,camY){
  const g=ctx.createLinearGradient(0,0,0,VH);
  g.addColorStop(0,th.sky[0]);g.addColorStop(.55,th.sky[1]);g.addColorStop(1,th.sky[2]);
  ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);
  const hor=VH*.8;
  if(th.night){ctx.fillStyle='#fff';
    for(const s of bgStars){const sx=((s.x-camX*.04)%2200+2200)%2200-100;
      if(sx<-10||sx>VW+10)continue;
      const tw=.4+.6*Math.abs(Math.sin(tNow*.8+s.p));
      ctx.globalAlpha=tw*.8;ctx.fillRect(sx,s.y*(VH/560),s.s,s.s);}
    ctx.globalAlpha=1;}
  if(shootStar){ctx.strokeStyle='rgba(255,244,230,.8)';ctx.lineWidth=2;ctx.lineCap='round';
    const a=Math.sin(shootStar.t/.8*Math.PI);ctx.globalAlpha=a;
    ctx.beginPath();ctx.moveTo(shootStar.x,shootStar.y);ctx.lineTo(shootStar.x-60,shootStar.y-22);ctx.stroke();ctx.globalAlpha=1;}
  // celestial
  if(th.cel==='moon'){
    const mx=VW*.76-camX*.015,my=VH*.2;
    ctx.drawImage(glowGold,mx-90,my-90,180,180);
    ctx.fillStyle='#fff4e6';ctx.beginPath();ctx.arc(mx,my,34,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(205,191,224,.5)';
    ctx.beginPath();ctx.arc(mx-10,my-6,6,0,TAU);ctx.arc(mx+8,my+10,4.5,0,TAU);ctx.arc(mx+12,my-11,3,0,TAU);ctx.fill();
  }else if(th.cel==='sun'){
    const sx=VW*.7-camX*.015,sy=hor-40;
    ctx.drawImage(glowGold,sx-150,sy-150,300,300);
    ctx.fillStyle='#ffd76b';ctx.beginPath();ctx.arc(sx,sy,44,0,TAU);ctx.fill();
  }else if(th.cel==='window'){
    const wx=((300-camX*.25)%1600+1600)%1600-200,wy=VH*.16;
    ctx.fillStyle='#1a1030';rr(wx,wy,220,170,14);ctx.fill();
    const wg=ctx.createLinearGradient(wx,wy,wx,wy+170);wg.addColorStop(0,'#0a0e2c');wg.addColorStop(1,'#3a2f6b');
    ctx.fillStyle=wg;rr(wx+10,wy+10,200,150,8);ctx.fill();
    ctx.drawImage(glowGold,wx+120,wy+16,80,80);
    ctx.fillStyle='#fff4e6';ctx.beginPath();ctx.arc(wx+160,wy+56,17,0,TAU);ctx.fill();
    ctx.strokeStyle='#1a1030';ctx.lineWidth=8;
    ctx.beginPath();ctx.moveTo(wx+110,wy+10);ctx.lineTo(wx+110,wy+160);ctx.moveTo(wx+10,wy+85);ctx.lineTo(wx+210,wy+85);ctx.stroke();
    ctx.strokeStyle='rgba(255,190,120,.3)';ctx.lineWidth=3;rr(wx,wy,220,170,14);ctx.stroke();
  }else if(th.cel==='roundwin'){
    const wx=((500-camX*.2)%1500+1500)%1500-150,wy=VH*.24;
    ctx.drawImage(glowGold,wx-70,wy-70,180,180);
    ctx.fillStyle='#141033';ctx.beginPath();ctx.arc(wx+20,wy+20,42,0,TAU);ctx.fill();
    ctx.fillStyle='#fff4e6';ctx.beginPath();ctx.arc(wx+30,wy+12,12,0,TAU);ctx.fill();
    ctx.strokeStyle='#3a2a44';ctx.lineWidth=6;
    ctx.beginPath();ctx.arc(wx+20,wy+20,42,0,TAU);ctx.moveTo(wx-22,wy+20);ctx.lineTo(wx+62,wy+20);
    ctx.moveTo(wx+20,wy-22);ctx.lineTo(wx+20,wy+62);ctx.stroke();
    ctx.fillStyle='rgba(255,220,160,.06)';
    ctx.beginPath();ctx.moveTo(wx-10,wy+50);ctx.lineTo(wx+50,wy+50);ctx.lineTo(wx+150,VH);ctx.lineTo(wx-90,VH);ctx.closePath();ctx.fill();
  }else if(th.cel==='clock'){
    const cx=VW*.5-camX*.06,cy=VH*.3,r=Math.min(130,VH*.24);
    ctx.drawImage(makeGlowCachePink,cx-r*1.7,cy-r*1.7,r*3.4,r*3.4);
    ctx.fillStyle='rgba(255,244,230,.92)';ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();
    ctx.strokeStyle='#4a1e4e';ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.stroke();
    ctx.lineWidth=3;
    for(let i=0;i<12;i++){const a=i/12*TAU;
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*(r-14),cy+Math.sin(a)*(r-14));
      ctx.lineTo(cx+Math.cos(a)*(r-5),cy+Math.sin(a)*(r-5));ctx.stroke();}
    ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(-TAU/4-.26)*(r*.5),cy+Math.sin(-TAU/4-.26)*(r*.5));ctx.stroke();
    const ma=-TAU/4-.1+Math.sin(tNow*.5)*.02;
    ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(ma)*(r*.78),cy+Math.sin(ma)*(r*.78));ctx.stroke();
    ctx.fillStyle='#4a1e4e';ctx.beginPath();ctx.arc(cx,cy,6,0,TAU);ctx.fill();
  }
  // far layer
  ctx.fillStyle=th.farC;
  const fo=camX*.15;
  for(const bld of bgFar){
    const sx=((bld.x-fo)%2600+2600)%2600-200;if(sx<-bld.w-20||sx>VW+20)continue;
    if(th.far==='trees'){
      ctx.beginPath();ctx.arc(sx+bld.w/2,hor-bld.h*.5,bld.w*.5,0,TAU);ctx.fill();
      ctx.fillRect(sx+bld.w/2-7,hor-bld.h*.5,14,bld.h*.5+20);
    }else if(th.far==='rafters'){
      ctx.save();ctx.translate(sx,hor);ctx.rotate(-.5);ctx.fillRect(0,-bld.h,26,bld.h+60);ctx.restore();
    }else if(th.far==='gears'){
      const gy=hor-bld.h*.6,gr=bld.w*.4;
      ctx.beginPath();ctx.arc(sx,gy,gr,0,TAU);ctx.fill();
      for(let i=0;i<8;i++){const a=i/8*TAU+tNow*.1*(bld.r>.5?1:-1);
        ctx.fillRect(sx+Math.cos(a)*gr-6,gy+Math.sin(a)*gr-6,12,12);}
    }else if(th.far==='stalls'){
      ctx.fillRect(sx,hor-bld.h*.4,bld.w,bld.h*.4+20);
      ctx.beginPath();ctx.moveTo(sx-8,hor-bld.h*.4);ctx.lineTo(sx+bld.w+8,hor-bld.h*.4);
      ctx.lineTo(sx+bld.w,hor-bld.h*.4-24);ctx.lineTo(sx,hor-bld.h*.4-24);ctx.closePath();ctx.fill();
    }else if(th.far==='cabinets'){
      ctx.fillRect(sx,VH*.45,bld.w,bld.h*.5);
      ctx.fillStyle='rgba(255,190,120,.12)';ctx.fillRect(sx+8,VH*.45+10,bld.w-16,4);ctx.fillStyle=th.farC;
    }else{
      ctx.fillRect(sx,hor-bld.h,bld.w,bld.h+40);
      if(th.far==='skyline'||th.far==='houses'){
        ctx.fillStyle='rgba(255,190,120,.55)';
        for(let wy=0;wy<3;wy++)for(let wx=0;wx<2;wx++)
          if(hash(wx+bld.x,wy)>.5)ctx.fillRect(sx+10+wx*(bld.w/2),hor-bld.h+14+wy*26,7,9);
        ctx.fillStyle=th.farC;}
    }
  }
  // mid layer
  ctx.fillStyle=th.midC;
  const mo=camX*.4;
  for(const it of bgMid){
    const sx=((it.x-mo)%2000+2000)%2000-150;if(sx<-160||sx>VW+160)continue;
    const my=VH*.92;
    if(th.mid==='trees'){
      ctx.fillRect(sx-5,my-70,10,70);
      ctx.beginPath();ctx.arc(sx,my-80,30+it.r*16,0,TAU);
      ctx.arc(sx-22,my-62,20+it.r*10,0,TAU);ctx.arc(sx+22,my-62,20+it.r2*10,0,TAU);ctx.fill();
    }else if(th.mid==='flowers'){
      ctx.fillRect(sx-2,my-34,4,34);
      ctx.fillStyle=it.r>.5?'rgba(255,112,166,.5)':'rgba(255,201,60,.45)';
      ctx.beginPath();ctx.arc(sx,my-40,8,0,TAU);ctx.fill();ctx.fillStyle=th.midC;
    }else if(th.mid==='boxes'){
      const bw=44+it.r*30;ctx.fillRect(sx-bw/2,my-36,bw,36);
      ctx.fillStyle='rgba(255,220,170,.08)';ctx.fillRect(sx-bw/2,my-36,bw,5);ctx.fillStyle=th.midC;
      if(it.r2>.5)ctx.fillRect(sx-bw/4,my-60,bw/2,24);
    }else if(th.mid==='chimneys'){
      ctx.fillRect(sx-14,my-58,28,58);ctx.fillRect(sx-19,my-64,38,8);
    }else if(th.mid==='lamps'){
      ctx.fillRect(sx-2,0,4,VH*.22);
      ctx.beginPath();ctx.moveTo(sx-20,VH*.22+22);ctx.lineTo(sx+20,VH*.22+22);ctx.lineTo(sx+8,VH*.22);ctx.lineTo(sx-8,VH*.22);ctx.closePath();ctx.fill();
      ctx.drawImage(glowGold,sx-40,VH*.22-6,80,80);
      ctx.fillStyle='#ffd76b';ctx.beginPath();ctx.arc(sx,VH*.22+24,5,0,TAU);ctx.fill();ctx.fillStyle=th.midC;
    }else if(th.mid==='beams'){
      ctx.save();ctx.translate(sx,my);ctx.rotate(it.r>.5?.6:-.6);ctx.fillRect(-9,-120,18,140);ctx.restore();
    }else if(th.mid==='bunting'){
      ctx.strokeStyle='rgba(255,244,230,.3)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(sx-60,VH*.3);ctx.quadraticCurveTo(sx,VH*.36,sx+60,VH*.3);ctx.stroke();
      const cols=['#ff5470','#ffc93c','#3ddc97','#4cc9f0','#ff70a6'];
      for(let i=0;i<5;i++){const t=i/4,bx=lerp(sx-56,sx+56,t),by=VH*.3+Math.sin(Math.PI*t)*VH*.055;
        ctx.fillStyle=cols[i];ctx.globalAlpha=.75;
        ctx.beginPath();ctx.moveTo(bx-6,by);ctx.lineTo(bx+6,by);ctx.lineTo(bx,by+13);ctx.closePath();ctx.fill();}
      ctx.globalAlpha=1;ctx.fillStyle=th.midC;
    }
  }
}
const makeGlowCachePink=makeGlow('rgba(255,112,166,.35)');

/* ---------- tiles ---------- */
function drawTiles(){
  const th=W.theme;
  const x0=Math.max(0,Math.floor((cam.x-VW/2)/T)-1),x1=Math.min(W.w-1,Math.ceil((cam.x+VW/2)/T)+1);
  const y0=Math.max(0,Math.floor((cam.y-VH/2)/T)-1),y1=Math.min(W.h-1,Math.ceil((cam.y+VH/2)/T)+1);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    const c=W.grid[ty][tx];if(c==='.')continue;
    const x=tx*T,y=ty*T;
    if(c==='#'){
      const openTop=ty===0||W.grid[ty-1][tx]!=='#';
      ctx.fillStyle=th.body;ctx.fillRect(x,y,T,T);
      ctx.strokeStyle=th.line;ctx.lineWidth=1.5;
      if(th.deco==='brick'){
        ctx.beginPath();ctx.moveTo(x,y+24);ctx.lineTo(x+T,y+24);
        const off=(ty%2)?12:32;ctx.moveTo(x+off,y+24);ctx.lineTo(x+off,y+T);
        if(!openTop){ctx.moveTo(x+((off+24)%48),y);ctx.lineTo(x+((off+24)%48),y+24);}ctx.stroke();
      }else if(th.deco==='plank'){
        ctx.beginPath();ctx.moveTo(x,y+16);ctx.lineTo(x+T,y+16);ctx.moveTo(x,y+34);ctx.lineTo(x+T,y+34);ctx.stroke();
      }else if(th.deco==='knob'&&hash(tx,ty)>.6){
        ctx.fillStyle='rgba(255,220,170,.35)';ctx.beginPath();ctx.arc(x+24,y+26,3,0,TAU);ctx.fill();
      }
      if(tx===0||W.grid[ty][tx-1]!=='#'){ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x,y,3,T);}
      if(tx===W.w-1||W.grid[ty][tx+1]!=='#'){ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(x+T-3,y,3,T);}
      if(openTop){
        ctx.fillStyle=th.top;rr(x-1,y-2,T+2,14,5);ctx.fill();
        ctx.fillStyle=th.lip;ctx.fillRect(x-1,y+9,T+2,5);
        ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x+3,y,T-6,2.5);
        if(th.deco==='grass'){
          ctx.strokeStyle=th.top;ctx.lineWidth=2.4;ctx.lineCap='round';
          for(let i=0;i<3;i++){const gx=x+8+hash(tx,i)*32,gh=5+hash(tx,i+9)*6;
            ctx.beginPath();ctx.moveTo(gx,y);ctx.quadraticCurveTo(gx+2,y-gh*.6,gx+(hash(tx,i+3)-.5)*6,y-gh);ctx.stroke();}
        }
      }
    }else if(c==='^'){
      ctx.fillStyle='#3a3050';ctx.fillRect(x+2,y+40,T-4,8);
      const mg=ctx.createLinearGradient(x,y+16,x,y+44);mg.addColorStop(0,'#e8eef8');mg.addColorStop(1,'#8a94b8');
      ctx.fillStyle=mg;
      for(let i=0;i<3;i++){const sx=x+4+i*14;
        ctx.beginPath();ctx.moveTo(sx,y+44);ctx.lineTo(sx+7,y+16);ctx.lineTo(sx+14,y+44);ctx.closePath();ctx.fill();}
      ctx.fillStyle='rgba(255,255,255,.7)';
      for(let i=0;i<3;i++)ctx.fillRect(x+10+i*14,y+20,1.6,7);
    }else if(c==='~'){
      ctx.fillStyle='rgba(76,201,240,.75)';
      ctx.beginPath();ctx.moveTo(x,y+18);
      for(let i=0;i<=T;i+=6)ctx.lineTo(x+i,y+18+Math.sin(tNow*3+(x+i)*.08)*2.5);
      ctx.lineTo(x+T,y+T);ctx.lineTo(x,y+T);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=2;
      ctx.beginPath();for(let i=0;i<=T;i+=6){const yy=y+18+Math.sin(tNow*3+(x+i)*.08)*2.5;
        i===0?ctx.moveTo(x+i,yy):ctx.lineTo(x+i,yy);}ctx.stroke();
      if(hash(tx,Math.floor(tNow*2))>.85){ctx.fillStyle='rgba(255,255,255,.6)';
        ctx.beginPath();ctx.arc(x+hash(tx,ty)*T,y+22,1.6,0,TAU);ctx.fill();}
    }
  }
}

/* ---------- entities ---------- */
function drawEntities(){
  const t=tNow;
  // checkpoints
  for(const k of W.checks){
    const gy=k.ground;
    ctx.fillStyle='#6b4a34';ctx.beginPath();ctx.ellipse(k.x,gy-3,16,5,0,0,TAU);ctx.fill();
    ctx.fillStyle='#8a6236';ctx.fillRect(k.x-3.5,gy-50,7,48);
    ctx.strokeStyle='rgba(60,40,25,.5)';ctx.lineWidth=1.4;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(k.x-3.5,gy-12-i*9);ctx.lineTo(k.x+3.5,gy-15-i*9);ctx.stroke();}
    const fy=gy-46+k.rise*0, rise=k.active?1:0;
    const flagY=gy-46+(1-k.rise)*18;
    ctx.fillStyle=k.active?'#3ddc97':'#6b5a8c';
    ctx.beginPath();ctx.moveTo(k.x+3.5,flagY);
    ctx.quadraticCurveTo(k.x+16,flagY+3+Math.sin(t*4)*2,k.x+26,flagY+6+Math.sin(t*4+1)*2.5);
    ctx.lineTo(k.x+3.5,flagY+13);ctx.closePath();ctx.fill();
    if(k.active)ctx.drawImage(glowMint,k.x-24,flagY-18,52,52);
    ctx.fillStyle='#ff70a6';ctx.beginPath();ctx.arc(k.x-11,gy-8,6,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(180,50,100,.6)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(k.x-11,gy-8,4,.4,2.6);ctx.stroke();
  }
  // springs
  for(const s of W.springs){
    const c=s.c,h=14-c*7,top=s.ground-4-h;
    ctx.fillStyle='#4a2440';ctx.fillRect(s.x-17,s.ground-4,34,4);
    const sg=ctx.createLinearGradient(s.x,top,s.x,top+h);sg.addColorStop(0,'#ff8fa3');sg.addColorStop(1,'#ff5470');
    ctx.fillStyle=sg;rr(s.x-20,top,40,h+2,7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.4)';rr(s.x-15,top+2,30,3,2);ctx.fill();
    ctx.fillStyle='#c23a56';ctx.beginPath();ctx.arc(s.x,top+h/2+1,2.6,0,TAU);ctx.fill();
  }
  // movers
  for(const m of W.movers){
    if(m.axis==='y'){ctx.fillStyle='rgba(255,244,230,.25)';
      for(let yy=m.by-m.amp-20;yy<m.y;yy+=14)ctx.fillRect(m.x+m.w/2-1.5,yy,3,6);}
    const mg=ctx.createLinearGradient(m.x,m.y,m.x,m.y+m.h);mg.addColorStop(0,'#c99a5e');mg.addColorStop(1,'#8a6236');
    ctx.fillStyle=mg;rr(m.x,m.y,m.w,m.h,6);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(m.x+5,m.y+2,m.w-10,2.5);
    ctx.fillStyle='#4a3050';rr(m.x-2,m.y+3,8,m.h-6,3);ctx.fill();rr(m.x+m.w-6,m.y+3,8,m.h-6,3);ctx.fill();
  }
  // yarns
  for(const y of W.yarns){if(y.got)continue;
    const by=y.y+Math.sin(t*2+y.ph)*3;
    ctx.save();ctx.translate(y.x,by);ctx.rotate(Math.sin(t+y.ph)*.2);
    ctx.strokeStyle='#ff70a6';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-9,4);ctx.quadraticCurveTo(-20,8,-26,2+Math.sin(t*3)*3);ctx.stroke();
    ctx.fillStyle='#ff70a6';ctx.beginPath();ctx.arc(0,0,10,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(190,50,105,.75)';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(0,-2,8,.3,2.8);ctx.stroke();
    ctx.beginPath();ctx.arc(1,3,8,3.5,5.9);ctx.stroke();
    ctx.beginPath();ctx.arc(-3,0,7,-1.2,1.2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(-3.5,-4,2.4,0,TAU);ctx.fill();
    ctx.restore();
  }
  // fish
  for(const f of W.fish){if(f.got)continue;
    const by=f.y+Math.sin(t*2+f.ph)*4;
    ctx.save();ctx.translate(f.x,by);ctx.rotate(Math.sin(t*1.6+f.ph)*.12);
    ctx.drawImage(fishSprite,-26,-26,52,52);ctx.restore();
    if(Math.random()<.02)spawnP(f.x+rnd(-14,14),by+rnd(-10,10),'sparkle',0,-20);
  }
  // goal
  const g=W.goal;if(g){
    const pulse=.8+Math.sin(t*2.4)*.2;
    ctx.globalAlpha=pulse;ctx.drawImage(glowGold,g.x-70,g.ground-96,140,140);ctx.globalAlpha=1;
    if(g.final){
      ctx.fillStyle='#8a6236';ctx.fillRect(g.x-42,g.ground-64,7,64);ctx.fillRect(g.x+35,g.ground-64,7,64);
      for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#fff4e6':'#ff5470';
        ctx.beginPath();ctx.moveTo(g.x-48+i*16,g.ground-64);ctx.lineTo(g.x-32+i*16,g.ground-64);
        ctx.lineTo(g.x-32+i*16,g.ground-52+((i%2)?3:0));ctx.quadraticCurveTo(g.x-40+i*16,g.ground-46,g.x-48+i*16,g.ground-52);ctx.closePath();ctx.fill();}
      ctx.fillStyle='#6b4a34';rr(g.x-34,g.ground-30,68,30,5);ctx.fill();
      ctx.strokeStyle='rgba(40,25,15,.4)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(g.x-34,g.ground-20);ctx.lineTo(g.x+34,g.ground-20);ctx.stroke();
      ctx.drawImage(fishSprite,g.x-30,g.ground-52,36,36);
      ctx.drawImage(fishSprite,g.x-8,g.ground-56,40,40);
      ctx.drawImage(fishSprite,g.x+12,g.ground-50,34,34);
    }else{
      ctx.fillStyle='#a8763e';rr(g.x-30,g.ground-26,60,26,9);ctx.fill();
      ctx.strokeStyle='rgba(90,55,25,.55)';ctx.lineWidth=2;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(g.x-28,g.ground-19+i*7);
        ctx.quadraticCurveTo(g.x,g.ground-15+i*7,g.x+28,g.ground-19+i*7);ctx.stroke();}
      ctx.fillStyle='#3ddc97';ctx.beginPath();ctx.ellipse(g.x,g.ground-24,26,7,0,0,TAU);ctx.fill();
      ctx.fillStyle='#2fa87c';ctx.beginPath();ctx.ellipse(g.x,g.ground-24,20,4.5,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#8a6236';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(g.x,g.ground-26,30,8,0,Math.PI,TAU);ctx.stroke();
      const sw=Math.sin(t*1.8)*.1;
      ctx.save();ctx.translate(g.x,g.ground-58);ctx.rotate(sw);
      ctx.strokeStyle='#8a6236';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(0,0);ctx.stroke();
      ctx.fillStyle='#c99a5e';rr(-16,0,32,20,5);ctx.fill();
      ctx.drawImage(fishSprite,-13,-1,26,26);ctx.restore();
    }
    if(Math.random()<.06)spawnP(g.x+rnd(-30,30),g.ground-rnd(20,70),'sparkle',rnd(-10,10),-30);
  }
}
function drawEnemy(e){
  const squash=e.alive?1:Math.max(.15,e.deadT/.5);
  const alpha=e.alive?1:Math.max(0,e.deadT/.5);
  ctx.save();ctx.globalAlpha=alpha;
  ctx.translate(e.x,e.y+e.h/2);ctx.scale(e.dir,squash);
  if(e.type==='dog'){
    const ph=e.anim*9;
    ctx.strokeStyle='#8a6236';ctx.lineWidth=5;ctx.lineCap='round';
    for(let i=0;i<4;i++){const hx=-15+i*10,fx=hx+(e.alive?Math.sin(ph+i*1.7)*5:0);
      ctx.beginPath();ctx.moveTo(hx,-10);ctx.lineTo(fx,-1);ctx.stroke();}
    ctx.strokeStyle='#b98a4e';ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(-20,-18);ctx.quadraticCurveTo(-27,-24+Math.sin(e.anim*7)*3,-25,-29);ctx.stroke();
    ctx.fillStyle='#b98a4e';rr(-21,-26,42,20,10);ctx.fill();
    ctx.fillStyle='rgba(255,235,200,.5)';ctx.beginPath();ctx.ellipse(-2,-9,13,5,0,0,TAU);ctx.fill();
    ctx.fillStyle='#b98a4e';rr(6,-34,22,20,8);ctx.fill();
    ctx.fillStyle='#d9b077';rr(20,-24,12,9,4);ctx.fill();
    ctx.fillStyle='#3a2430';ctx.beginPath();ctx.arc(31,-21,2.6,0,TAU);ctx.fill();
    ctx.fillStyle='#8a6236';ctx.beginPath();ctx.moveTo(9,-33);ctx.quadraticCurveTo(1,-30,4,-18);
    ctx.quadraticCurveTo(9,-16,11,-24);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2a1030';ctx.beginPath();ctx.arc(19,-27,2.2,0,TAU);ctx.fill();
    ctx.strokeStyle='#2a1030';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(15,-31);ctx.lineTo(22,-29);ctx.stroke();
    ctx.fillStyle='#ff5470';ctx.fillRect(7,-17,17,4);
    ctx.fillStyle='#ffc93c';ctx.beginPath();ctx.arc(15,-11,2.6,0,TAU);ctx.fill();
  }else{
    const on=e.alive;
    ctx.strokeStyle='#3a4a6a';ctx.lineWidth=2.4;ctx.lineCap='round';
    for(const bx of [-16,16]){const rot=e.anim*10;
      for(let i=0;i<3;i++){const a=rot+i*TAU/3;
        ctx.beginPath();ctx.moveTo(bx,-2);ctx.lineTo(bx+Math.cos(a)*7,-2+Math.sin(a)*4);ctx.stroke();}}
    ctx.fillStyle=on?'#6b7fa8':'#55596b';ctx.beginPath();ctx.ellipse(0,-10,23,10,0,0,TAU);ctx.fill();
    ctx.fillStyle=on?'#93a9d1':'#6e7280';ctx.beginPath();ctx.ellipse(0,-14,16,7,0,0,TAU);ctx.fill();
    ctx.fillStyle='#3a4a6a';ctx.beginPath();ctx.ellipse(19,-8,5,7,0,0,TAU);ctx.fill();
    if(on){const bl=.6+Math.sin(e.anim*6)*.4;
      ctx.globalAlpha=alpha*bl;ctx.drawImage(glowRed,2,-26,26,26);ctx.globalAlpha=alpha;
      ctx.fillStyle='#ff5470';ctx.beginPath();ctx.arc(15,-14,3,0,TAU);ctx.fill();}
    else{ctx.fillStyle='#3a3f4e';ctx.beginPath();ctx.arc(15,-14,3,0,TAU);ctx.fill();
      ctx.strokeStyle='#3a3f4e';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(12,-17);ctx.lineTo(18,-11);ctx.moveTo(18,-17);ctx.lineTo(12,-11);ctx.stroke();}
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.ellipse(-5,-16,8,2.5,-.2,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawShadow(p){
  const feet=p.y+p.h/2;let gy=null;
  const tx=Math.floor(p.x/T);
  for(let ty=Math.max(0,Math.floor(feet/T));ty<Math.min(W.h,Math.floor(feet/T)+6);ty++){
    if(tx>=0&&tx<W.w&&W.grid[ty][tx]==='#'){gy=ty*T;break;}}
  for(const m of W.movers)if(p.x>m.x&&p.x<m.x+m.w&&m.y>=feet-2&&(gy===null||m.y<gy))gy=m.y;
  if(gy===null)return;
  const d=gy-feet;if(d>230)return;
  const a=.32*(1-d/240);
  ctx.fillStyle='rgba(10,5,20,'+a.toFixed(3)+')';
  ctx.beginPath();ctx.ellipse(p.x,gy+3,21*(1-d/320),5,0,0,TAU);ctx.fill();
}

/* ---------- particles draw ---------- */
function drawParticles(){
  for(const p of particles){
    const a=clamp(p.life/p.max,0,1);
    if(p.type==='dust'||p.type==='poof'){
      ctx.fillStyle=p.col+(a*.7).toFixed(3)+')';
      ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1.6-a*.6),0,TAU);ctx.fill();
    }else if(p.type==='confetti'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=a;
      ctx.fillStyle=p.col;ctx.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);ctx.restore();ctx.globalAlpha=1;
    }else if(p.type==='heart'){
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=a;ctx.fillStyle=p.col;
      const s=p.size;
      ctx.beginPath();ctx.moveTo(0,s*.35);
      ctx.bezierCurveTo(-s,-s*.45,-s*.4,-s*1.1,0,-s*.35);
      ctx.bezierCurveTo(s*.4,-s*1.1,s,-s*.45,0,s*.35);ctx.fill();
      ctx.restore();ctx.globalAlpha=1;
    }else if(p.type==='sparkle'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=a;ctx.fillStyle=p.col;
      const s=p.size;
      ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*.18,-s*.18,s,0);ctx.quadraticCurveTo(s*.18,s*.18,0,s);
      ctx.quadraticCurveTo(-s*.18,s*.18,-s,0);ctx.quadraticCurveTo(-s*.18,-s*.18,0,-s);ctx.fill();
      ctx.restore();ctx.globalAlpha=1;
    }else if(p.type==='petal'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=a*.8;ctx.fillStyle=p.col;
      ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*.55,0,0,TAU);ctx.fill();ctx.restore();ctx.globalAlpha=1;
    }else{
      ctx.globalAlpha=a;ctx.fillStyle=p.col;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();ctx.globalAlpha=1;
    }
  }
}
function drawAmbient(worldSpace){
  ctx.save();
  for(const a of ambient){
    const al=clamp(a.life/2,0,1)*clamp((a.max-a.life)/1.5,0,1);
    if(a.type==='firefly'){
      ctx.globalCompositeOperation='lighter';
      const tw=.5+.5*Math.sin(a.ph*3);
      ctx.globalAlpha=al*tw;ctx.drawImage(glowMint,a.x-10,a.y-10,20,20);
      ctx.fillStyle='#d8ffe9';ctx.beginPath();ctx.arc(a.x,a.y,1.6,0,TAU);ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }else if(a.type==='mote'){
      ctx.globalAlpha=al*.5;ctx.fillStyle='#ffe9c9';
      ctx.beginPath();ctx.arc(a.x,a.y,1.4,0,TAU);ctx.fill();
    }else if(a.type==='petal'){
      ctx.globalAlpha=al*.85;ctx.fillStyle='#ff9fb0';
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.ph*2);
      ctx.beginPath();ctx.ellipse(0,0,4,2.2,0,0,TAU);ctx.fill();ctx.restore();
    }
  }
  ctx.globalAlpha=1;ctx.restore();
}
function drawFloaters(){
  ctx.font='700 15px Comfortaa, Nunito, sans-serif';ctx.textAlign='center';
  for(const f of floaters){
    const a=clamp(f.life,0,1);
    ctx.globalAlpha=a;ctx.lineWidth=4;ctx.strokeStyle='rgba(20,10,35,.85)';
    ctx.strokeText(f.txt,f.x,f.y);ctx.fillStyle=f.col;ctx.fillText(f.txt,f.x,f.y);
  }
  ctx.globalAlpha=1;ctx.textAlign='left';
}

/* ---------- world render ---------- */
function renderWorld(){
  const shx=(Math.random()-.5)*shake,shy=(Math.random()-.5)*shake;
  drawBG(W.theme,cam.x,cam.y);
  ctx.save();
  ctx.translate(VW/2-cam.x+shx,VH/2-cam.y+shy);
  drawAmbient(true);
  drawTiles();
  drawEntities();
  for(const e of W.enemies)if(e.alive||e.deadT>0)drawEnemy(e);
  if(P){drawShadow(P);drawCat(ctx,P,false,tNow);}
  drawParticles();
  drawFloaters();
  ctx.restore();
  // rain (screen space)
  if(rain.length){
    ctx.strokeStyle='rgba(160,200,255,.4)';ctx.lineWidth=1.6;ctx.lineCap='round';
    ctx.beginPath();
    for(const r of rain){ctx.moveTo(r.x,r.y);ctx.lineTo(r.x+3.4,r.y-22);}
    ctx.stroke();
  }
  if(lightningA>.01){ctx.fillStyle='rgba(230,240,255,'+(lightningA*.55).toFixed(3)+')';ctx.fillRect(0,0,VW,VH);}
  // bottom fog
  const fg=ctx.createLinearGradient(0,VH-110,0,VH);
  fg.addColorStop(0,'rgba(10,5,20,0)');fg.addColorStop(1,'rgba(10,5,20,.5)');
  ctx.fillStyle=fg;ctx.fillRect(0,VH-110,VW,110);
  // goal direction hint
  if(G.state==='play'&&W.goal&&P&&!P.clearing){
    const gsx=W.goal.x-cam.x+VW/2;
    if(gsx>VW+30){
      const gy=clamp(W.goal.ground-cam.y+VH/2-40,70,VH-90);
      const pu=.7+Math.sin(tNow*4)*.3;
      ctx.globalAlpha=pu;ctx.drawImage(glowGold,VW-64,gy-26,60,60);
      ctx.fillStyle='#ffc93c';
      ctx.beginPath();ctx.moveTo(VW-26,gy-11);ctx.lineTo(VW-12,gy);ctx.lineTo(VW-26,gy+11);ctx.closePath();ctx.fill();
      ctx.drawImage(fishSprite,VW-62,gy-16,34,34);ctx.globalAlpha=1;
    }
  }
  if(hurtFlash>0){ctx.fillStyle='rgba(255,84,112,'+(hurtFlash*.3).toFixed(3)+')';ctx.fillRect(0,0,VW,VH);}
  if(respawnT>0){const a=Math.sin(clamp(respawnT/.5,0,1)*Math.PI);
    ctx.fillStyle='rgba(14,7,26,'+(a*.9).toFixed(3)+')';ctx.fillRect(0,0,VW,VH);}
}
/* ---------- demo scene (title / levels) ---------- */
function renderDemo(){
  drawBG(THEMES.roof,tNow*14,0);
  const gy=VH-64;
  const th=THEMES.roof;
  ctx.fillStyle=th.body;ctx.fillRect(0,gy,VW,80);
  ctx.strokeStyle=th.line;ctx.lineWidth=1.5;
  for(let x=0;x<VW;x+=48){ctx.beginPath();ctx.moveTo(x,gy+24);ctx.lineTo(x+48,gy+24);
    ctx.moveTo(x+24,gy+24);ctx.lineTo(x+24,gy+64);ctx.stroke();}
  ctx.fillStyle=th.top;rr(-4,gy-2,VW+8,14,5);ctx.fill();
  ctx.fillStyle=th.lip;ctx.fillRect(-4,gy+9,VW+8,5);
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(0,gy,VW,2.5);
  demoCat.x=VW*.5;demoCat.y=gy-15;demoCat.dir=1;
  ctx.fillStyle='rgba(10,5,20,.3)';ctx.beginPath();ctx.ellipse(demoCat.x,gy+3,24,5,0,0,TAU);ctx.fill();
  drawCat(ctx,demoCat,true,tNow);
  // ambient fireflies view-space
  drawAmbient(false);
  for(const p of demoParts){
    const a=clamp(p.life/p.max,0,1);
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=a;ctx.fillStyle='#ff70a6';
    const s=7;ctx.beginPath();ctx.moveTo(0,s*.35);
    ctx.bezierCurveTo(-s,-s*.45,-s*.4,-s*1.1,0,-s*.35);
    ctx.bezierCurveTo(s*.4,-s*1.1,s,-s*.45,0,s*.35);ctx.fill();ctx.restore();
  }
  ctx.globalAlpha=1;
  const fg=ctx.createLinearGradient(0,VH-110,0,VH);
  fg.addColorStop(0,'rgba(10,5,20,0)');fg.addColorStop(1,'rgba(10,5,20,.5)');
  ctx.fillStyle=fg;ctx.fillRect(0,VH-110,VW,110);
}

/* ============================================================
   UI / STATE MACHINE
   ============================================================ */
const SCREENS={title:'scr-title',levels:'scr-levels',intro:'scr-intro',pause:'scr-pause',clear:'scr-clear',over:'scr-over',win:'scr-win'};
function setState(st){
  G.state=st;document.body.dataset.state=st;
  for(const k in SCREENS)$(SCREENS[k]).classList.toggle('on',k===st);
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
}
function primaryAction(){
  switch(G.state){
    case 'title':$('btnPlay').click();break;
    case 'intro':$('btnBegin').click();break;
    case 'pause':resumeGame();break;
    case 'clear':$('btnNext').click();break;
    case 'over':$('btnRetry').click();break;
    case 'win':$('btnWinLevels').click();break;
  }
}
function startIntro(idx){
  G.level=idx;loadLevel(idx);
  $('introNum').textContent=idx+1;
  $('introKick').textContent='уровень '+(idx+1)+' из 8';
  $('introName').textContent=LEVELS[idx].name;
  $('introStory').innerHTML=LEVELS[idx].story;
  setState('intro');
}
function beginPlay(){SFX.click();input.jbuf=0;keyJ=false;tJ=false;syncInput();setState('play');}
function retryLevel(){loadLevel(G.level);input.jbuf=0;setState('play');}
function pauseGame(){
  if(G.state!=='play'||P.dead||P.clearing)return;
  const mm=Math.floor(G.time/60),ss=Math.floor(G.time%60);
  $('pauseStats').innerHTML=
    statHTML('fish','рыбки '+G.fish+'/3','#ffc93c')+
    statHTML('heart','жизни ×'+G.lives,'#ff5470')+
    statHTML('clock',mm+':'+String(ss).padStart(2,'0'),'#4cc9f0');
  setState('pause');
}
function resumeGame(){SFX.click();setState('play');}
function statHTML(icon,txt,col){
  const paths={
    fish:'<path d="M2.5 12c2.4-3.6 5.8-5.6 9.3-5.6 3.4 0 6.5 2 8.7 5.6-2.2 3.6-5.3 5.6-8.7 5.6-3.5 0-6.9-2-9.3-5.6z"/><path d="M20.5 12l3-3.4v6.8z"/>',
    heart:'<path d="M12 21s-7.6-4.8-10-9.1C.3 8.9 2.3 5 6 5c2.2 0 3.7 1.2 6 3.6C14.3 6.2 15.8 5 18 5c3.7 0 5.7 3.9 4 6.9C19.6 16.2 12 21 12 21z"/>',
    clock:'<circle cx="12" cy="12" r="9" fill="none" stroke="COL" stroke-width="2.4"/><path d="M12 6.5V12l3.6 2.4" fill="none" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>',
    star:'<path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"/>'
  };
  return '<div class="stat"><svg viewBox="0 0 24 24" fill="'+col+'">'+paths[icon].replaceAll('COL',col)+'</svg>'+txt+'</div>';
}
function showClear(){
  const stars=save.s[G.level]||1;
  const earned=[true,G.fish===3,G.deaths===0];
  const labels=['финиш','все рыбки','без царапин'];
  const cont=$('clearStars');cont.innerHTML='';
  earned.forEach((e,i)=>{
    const d=document.createElement('div');d.className='bstar'+(e?' earned':'');
    d.innerHTML='<svg viewBox="0 0 24 24" style="animation-delay:'+(0.25+i*.3)+'s"><path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"/></svg><span>'+labels[i]+'</span>';
    cont.appendChild(d);
    if(e)setTimeout(()=>{if(G.state==='clear')SFX.star(i);},(0.25+i*.3)*1000);
  });
  const mm=Math.floor(G.time/60),ss=Math.floor(G.time%60);
  $('clearStats').innerHTML=statHTML('fish',G.fish+'/3','#ffc93c')+statHTML('clock',mm+':'+String(ss).padStart(2,'0'),'#4cc9f0')+
    statHTML('heart','потери: '+G.deaths,'#ff5470');
  $('btnNext').textContent=G.level<7?'Дальше ▶':'Финал! ★';
  setState('clear');
}
function showOver(){setState('over');}
function showWin(){
  const ts=save.s.reduce((a,b)=>a+b,0),tf=save.f.reduce((a,b)=>a+b,0);
  $('winStats').innerHTML=statHTML('star','звёзды '+ts+'/24','#ffc93c')+statHTML('fish','рыбки '+tf+'/24','#ffb347');
  SFX.fanfare();winConfettiT=0;setState('win');
}
function showLevels(){
  const grid=$('lvGrid');grid.innerHTML='';
  LEVELS.forEach((lv,i)=>{
    const locked=i+1>save.u;
    const c=document.createElement('button');c.className='lvcard'+(locked?' locked':'');
    c.style.setProperty('--g1',LV_GRADS[i][0]);c.style.setProperty('--g2',LV_GRADS[i][1]);
    let stars='';for(let s=0;s<3;s++)stars+='<svg viewBox="0 0 24 24" class="'+(s<save.s[i]?'e':'')+'"><path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"/></svg>';
    c.innerHTML='<span class="num">'+(i+1)+'</span>'+
      '<svg class="icon" viewBox="0 0 24 24"><style>.st{fill:none;stroke:#fff4e6;stroke-width:2;stroke-linecap:round}</style>'+LV_ICONS[i]+'</svg>'+
      '<div class="nm">'+lv.name+'</div><div class="stars">'+stars+'</div>'+
      (locked?'<div class="lock"><svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 016 0v3" fill="none" stroke="#cdbfe0" stroke-width="2.2"/></svg></div>':'');
    if(!locked)c.addEventListener('click',()=>{SFX.click();startIntro(i);});
    grid.appendChild(c);
  });
  setState('levels');
}
/* buttons */
$('btnPlay').addEventListener('click',()=>{SFX.click();startIntro(clamp(save.u-1,0,7));});
$('btnLevels').addEventListener('click',()=>{SFX.click();showLevels();});
$('btnLvBack').addEventListener('click',()=>{SFX.click();setState('title');});
$('btnBegin').addEventListener('click',beginPlay);
$('btnResume').addEventListener('click',resumeGame);
$('btnPauseRetry').addEventListener('click',()=>{SFX.click();retryLevel();});
$('btnPauseLevels').addEventListener('click',()=>{SFX.click();showLevels();});
$('btnNext').addEventListener('click',()=>{SFX.click();if(G.level<7)startIntro(G.level+1);else showWin();});
$('btnClearRetry').addEventListener('click',()=>{SFX.click();retryLevel();});
$('btnClearLevels').addEventListener('click',()=>{SFX.click();showLevels();});
$('btnRetry').addEventListener('click',()=>{SFX.click();retryLevel();});
$('btnOverLevels').addEventListener('click',()=>{SFX.click();showLevels();});
$('btnWinLevels').addEventListener('click',()=>{SFX.click();showLevels();});
$('btnWinMenu').addEventListener('click',()=>{SFX.click();setState('title');});
$('btnPause').addEventListener('click',()=>{SFX.click();pauseGame();});
$('btnRestart').addEventListener('click',()=>{SFX.click();retryLevel();});
$('btnSound').addEventListener('click',()=>{initAudio();setMuted(!audio.muted);if(!audio.muted)SFX.click();});
let resetArmed=false;
$('btnReset').addEventListener('click',()=>{
  if(!resetArmed){resetArmed=true;$('btnReset').textContent='точно сбросить? нажми ещё раз';
    setTimeout(()=>{resetArmed=false;$('btnReset').textContent='сбросить прогресс';},2500);return;}
  save={u:1,s:[0,0,0,0,0,0,0,0],f:[0,0,0,0,0,0,0,0],snd:audio.muted?0:1};persist();
  resetArmed=false;$('btnReset').textContent='сбросить прогресс';SFX.spark();showLevels();
});
setMuted(audio.muted);

/* ============================================================
   MAIN LOOP
   ============================================================ */
let last=performance.now(),acc=0;
function frame(ts){
  requestAnimationFrame(frame);
  let dt=Math.min((ts-last)/1000,.05);last=ts;
  if(G.state==='play'){acc+=dt;while(acc>=STEP){updatePlay(STEP);acc-=STEP;if(G.state!=='play'){acc=0;break;}}}
  else acc=0;
  updateFx(dt);
  ctx.setTransform(DPR*S,0,0,DPR*S,0,0);
  if(W&&['intro','play','pause','clear','over','win'].includes(G.state))renderWorld();
  else renderDemo();
}
requestAnimationFrame(frame);

})();
