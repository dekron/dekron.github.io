export const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
export const rand=(a,b)=>a+Math.random()*(b-a),randi=(a,b)=>Math.floor(rand(a,b+1));
export const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,FINE=matchMedia('(hover:hover) and (pointer:fine)').matches;
export const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export const fmtN=n=>Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ');
export const ico=(n,c='')=>`<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
export function hslHex(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));const t=x=>Math.round(255*x).toString(16).padStart(2,'0');return'#'+t(f(0))+t(f(8))+t(f(4));}
export const store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
export function download(name,content,mime){const b=new Blob([content],{type:mime||'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);}
export function paintRange(el){const p=(el.value-el.min)/(el.max-el.min)*100;el.style.setProperty('--p',p+'%');}

