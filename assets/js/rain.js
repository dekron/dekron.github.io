import { $, rand, randi, RM } from './utils.js';

export const Rain={cv:null,ctx:null,drops:[],speeds:[],last:0,c1:'rgba(0,240,255,.6)',c2:'rgba(255,43,214,.55)',chars:'アイウエオカキクケコサシスセソ0123456789DV<>/*+=¥',
init(){this.cv=$('#rain');this.ctx=this.cv.getContext('2d');this.resize();let to;window.addEventListener('resize',()=>{clearTimeout(to);to=setTimeout(()=>this.resize(),200);});},
resize(){const w=innerWidth,h=innerHeight;this.cv.width=w;this.cv.height=h;const n=Math.floor(w/16);this.drops=Array.from({length:n},()=>rand(-40,0));this.speeds=Array.from({length:n},()=>rand(.4,1.3));this.ctx.fillStyle='#05070f';this.ctx.fillRect(0,0,w,h);},
setColor(h){this.c1=`hsla(${h},100%,62%,.6)`;this.c2=`hsla(${(h+130)%360},100%,62%,.5)`;},
tick(ts){if(RM||document.hidden||ts-this.last<50)return;this.last=ts;const ctx=this.ctx,w=this.cv.width,h=this.cv.height;
ctx.fillStyle='rgba(5,7,15,.16)';ctx.fillRect(0,0,w,h);ctx.font='13px "JetBrains Mono",monospace';
for(let i=0;i<this.drops.length;i++){ctx.fillStyle=i%7===0?this.c2:this.c1;ctx.fillText(this.chars[randi(0,this.chars.length-1)],i*16,this.drops[i]*16);this.drops[i]+=this.speeds[i];if(this.drops[i]*16>h&&Math.random()>.976)this.drops[i]=rand(-20,0);}}};
