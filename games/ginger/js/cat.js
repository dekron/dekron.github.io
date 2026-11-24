window.Ginger = window.Ginger || {};
(() => {
'use strict';
const TAU=Math.PI*2;
const FUR='#ff9f45',FURD='#e2762b',CREAM='#ffe9d2',EARP='#ff8fa3',EYE='#3ddc97',DARK='#2a1030';
function drawCat(ctx,p,sit,tNow){
  const t=tNow;
  const blink=p.blink>0?.12:1;
  const happy=p.happy>0;
  const run=p.grounded&&Math.abs(p.vx)>40;
  const air=!p.grounded&&!sit;
  const ph=p.phase*TAU;
  ctx.save();
  ctx.translate(p.x,p.y+p.h/2);
  if(p.rot)ctx.rotate(p.rot);
  ctx.scale(p.dir*(p.sx||1),p.sy||1);
  if(p.inv>0&&Math.floor(t*14)%2===0)ctx.globalAlpha=.4;
  const bodyY=sit?-4:0;
  // tail
  const tw=run?1.5:1;
  const w1=Math.sin(t*2.6)*4*tw,w2=Math.sin(t*2.6+1.2)*6*tw,w3=Math.sin(t*2.6+2.1)*5*tw;
  ctx.strokeStyle=FUR;ctx.lineWidth=7;ctx.lineCap='round';
  ctx.beginPath();
  if(sit){ctx.moveTo(-14,-6);ctx.bezierCurveTo(-26,-4,-28,2+w1*.4,-16,3);
    ctx.quadraticCurveTo(-4,5+w2*.3,4,2+w3*.4);}
  else{ctx.moveTo(-20,-14+bodyY);ctx.bezierCurveTo(-30,-16+w1+bodyY,-38,-30+w2+bodyY,-33,-40+w3+bodyY);}
  ctx.stroke();
  ctx.strokeStyle=FURD;ctx.lineWidth=7;
  ctx.beginPath();
  if(sit){ctx.moveTo(1,2.6+w3*.4);ctx.lineTo(4,2+w3*.4);}
  else{ctx.moveTo(-34.4,-36+w3+bodyY);ctx.lineTo(-33,-40+w3+bodyY);}
  ctx.stroke();
  // far legs
  const legY=-10+bodyY;
  const leg=(hx,phase,col,paw)=>{
    let fx=hx,fy=0;
    if(sit){fx=hx;fy=0;}
    else if(run){fx=hx+Math.sin(phase)*7;fy=-Math.max(0,Math.sin(phase+Math.PI/2))*5;}
    else if(air){if(p.vy<0){fx=hx+(hx>0?5:-5);fy=-6;}else{fx=hx+(hx>0?9:-8);fy=-2;}}
    ctx.strokeStyle=col;ctx.lineWidth=6.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(hx,legY);ctx.lineTo(fx,fy-2);ctx.stroke();
    if(paw){ctx.fillStyle=CREAM;ctx.beginPath();ctx.arc(fx,fy-1.5,3.4,0,TAU);ctx.fill();}
  };
  if(sit){leg(-8,0,FURD,false);}
  else{leg(-11,ph+Math.PI,FURD,false);leg(15,ph+Math.PI*.6,FURD,false);}
  // body
  ctx.fillStyle=FUR;
  ctx.beginPath();
  if(sit){
    ctx.moveTo(-18,0);ctx.quadraticCurveTo(-22,-22,-8,-30);
    ctx.quadraticCurveTo(4,-36,10,-28);ctx.quadraticCurveTo(15,-18,14,-4);
    ctx.quadraticCurveTo(14,0,8,0);ctx.closePath();ctx.fill();
    ctx.fillStyle=CREAM;ctx.beginPath();ctx.ellipse(4,-12,7,11,0,0,TAU);ctx.fill();
    ctx.strokeStyle=FURD;ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-14,-24);ctx.quadraticCurveTo(-9,-27,-5,-25);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-16,-16);ctx.quadraticCurveTo(-11,-19,-7,-17);ctx.stroke();
  }else{
    ctx.moveTo(-22,-8+bodyY);ctx.quadraticCurveTo(-26,-24+bodyY,-12,-27+bodyY);
    ctx.quadraticCurveTo(6,-30+bodyY,14,-24+bodyY);ctx.quadraticCurveTo(20,-20+bodyY,20,-12+bodyY);
    ctx.quadraticCurveTo(20,-4+bodyY,12,-3+bodyY);ctx.lineTo(-14,-3+bodyY);
    ctx.quadraticCurveTo(-24,-3+bodyY,-22,-8+bodyY);ctx.closePath();ctx.fill();
    ctx.fillStyle=CREAM;ctx.beginPath();ctx.ellipse(0,-6+bodyY,13,4.5,0,0,TAU);ctx.fill();
    ctx.strokeStyle=FURD;ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-15,-25+bodyY);ctx.quadraticCurveTo(-11,-28+bodyY,-7,-26+bodyY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-6,-27.5+bodyY);ctx.quadraticCurveTo(-2,-30+bodyY,2,-28+bodyY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(3,-27+bodyY);ctx.quadraticCurveTo(7,-29+bodyY,10,-26+bodyY);ctx.stroke();
  }
  // near legs
  if(sit){leg(8,0,FUR,true);leg(2,0,FUR,true);}
  else{leg(-15,ph,FUR,true);leg(11,ph+Math.PI*1.4,FUR,true);}
  // head
  const hx=sit?8:16,hy=sit?-34:-26+bodyY;
  const twitch=(Math.sin(t*.7)>.995)?2:0;
  ctx.fillStyle=FUR;
  ctx.beginPath();ctx.moveTo(hx-10,hy-6);ctx.lineTo(hx-13,hy-17+twitch);ctx.lineTo(hx-2,hy-11);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(hx+2,hy-11);ctx.lineTo(hx+8,hy-19);ctx.lineTo(hx+12,hy-7);ctx.closePath();ctx.fill();
  ctx.fillStyle=EARP;
  ctx.beginPath();ctx.moveTo(hx-9.4,hy-8);ctx.lineTo(hx-11,hy-14+twitch);ctx.lineTo(hx-4.5,hy-10.4);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(hx+4,hy-11);ctx.lineTo(hx+7.4,hy-15.6);ctx.lineTo(hx+9.6,hy-8.6);ctx.closePath();ctx.fill();
  ctx.fillStyle=FUR;ctx.beginPath();ctx.arc(hx,hy,12.5,0,TAU);ctx.fill();
  ctx.beginPath();ctx.moveTo(hx-12,hy+2);ctx.lineTo(hx-16,hy+5);ctx.lineTo(hx-11,hy+7);ctx.closePath();ctx.fill();
  ctx.strokeStyle=FURD;ctx.lineWidth=2.4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(hx-4,hy-11);ctx.lineTo(hx-2,hy-7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(hx+1,hy-12);ctx.lineTo(hx+2,hy-8);ctx.stroke();
  // eyes
  const eye=(ex,ey,r)=>{
    if(happy){ctx.strokeStyle=DARK;ctx.lineWidth=2.2;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(ex,ey+1.5,r+1,Math.PI+.4,TAU-.4);ctx.stroke();return;}
    if(p.dead){ctx.strokeStyle=DARK;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(ex-r,ey-r);ctx.lineTo(ex+r,ey+r);ctx.moveTo(ex+r,ey-r);ctx.lineTo(ex-r,ey+r);ctx.stroke();return;}
    ctx.fillStyle='#fff8ee';ctx.beginPath();ctx.ellipse(ex,ey,r+1,(r+1.6)*blink,0,0,TAU);ctx.fill();
    if(blink>.3){
      ctx.fillStyle=EYE;ctx.beginPath();ctx.ellipse(ex+.5,ey,r,r*1.25,0,0,TAU);ctx.fill();
      ctx.fillStyle=DARK;ctx.beginPath();ctx.ellipse(ex+.8,ey,r*.34,r*1.05,0,0,TAU);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+1.4,ey-1.4,.9,0,TAU);ctx.fill();}
  };
  eye(hx-3.5,hy-1,2.4);eye(hx+5,hy-1,3.2);
  // muzzle
  ctx.fillStyle=CREAM;ctx.beginPath();ctx.ellipse(hx+8,hy+5,5.5,4.5,0,0,TAU);ctx.fill();
  ctx.fillStyle='#ff5470';ctx.beginPath();ctx.moveTo(hx+10.5,hy+2.4);ctx.lineTo(hx+14,hy+2.4);ctx.lineTo(hx+12.2,hy+5);ctx.closePath();ctx.fill();
  ctx.strokeStyle=DARK;ctx.lineWidth=1.4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(hx+12.2,hy+5);ctx.lineTo(hx+12.2,hy+6.6);
  ctx.arc(hx+10.4,hy+6.6,1.8,0,Math.PI);ctx.stroke();
  ctx.beginPath();ctx.arc(hx+14,hy+6.6,1.8,0,Math.PI);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.1;
  ctx.beginPath();
  ctx.moveTo(hx+11,hy+4);ctx.lineTo(hx+22,hy+1.5);
  ctx.moveTo(hx+11,hy+5.5);ctx.lineTo(hx+23,hy+5.5);
  ctx.moveTo(hx+11,hy+7);ctx.lineTo(hx+22,hy+9);
  ctx.moveTo(hx+4,hy+5);ctx.lineTo(hx-4,hy+4);
  ctx.moveTo(hx+4,hy+6.5);ctx.lineTo(hx-4,hy+8);
  ctx.stroke();
  ctx.restore();
}

Object.assign(window.Ginger, { drawCat });
})();
