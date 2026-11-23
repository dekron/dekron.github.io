import { $, clamp, lerp, rand, randi, RM } from './utils.js';

export function initScene(){if(typeof THREE==='undefined')return null;try{
const wrap=$('#coreStage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
wrap.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x05070f,.036);
const camera=new THREE.PerspectiveCamera(45,1,.1,100);
const col=(h,s,l)=>new THREE.Color().setHSL((((h%360)+360)%360)/360,s,l);
const P={hue:187,parts:900,speed:1,glow:.6,wire:true,grid:true,auto:!RM};
const cam={theta:.65,phi:1.12,dist:9.4,tTheta:.65,tPhi:1.12,tDist:9.4};
let pulse=0,idleT=9;
scene.add(new THREE.AmbientLight(0x1b2140,.9));
const key=new THREE.PointLight(0x00f0ff,1.5,32);key.position.set(4,3,5);scene.add(key);
const rim=new THREE.PointLight(0xff2bd6,1.2,32);rim.position.set(-5,2,-4);scene.add(rim);
const fill=new THREE.PointLight(0x7b2bff,.55,26);fill.position.set(0,-4,4);scene.add(fill);
const coreMat=new THREE.MeshStandardMaterial({color:0x0a0f22,metalness:.85,roughness:.3,emissive:col(187,1,.6),emissiveIntensity:.5,flatShading:true});
const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,0),coreMat);scene.add(core);
const wireMat=new THREE.MeshBasicMaterial({color:col(187,1,.6),wireframe:true,transparent:true,opacity:.5});
const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(1.7,1),wireMat);scene.add(wire);
const shellMat=new THREE.MeshBasicMaterial({color:col(317,1,.62),wireframe:true,transparent:true,opacity:.17});
const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(1.36,0),shellMat);scene.add(shell);
const ringMats=[],rings=[],ringGroups=[];
[[2.5,.02,.7],[3.1,.015,.45],[2.05,.018,.55]].forEach((r,i)=>{const m=new THREE.MeshBasicMaterial({color:col(187+i*130,1,.6),transparent:true,opacity:r[2]});ringMats.push(m);
const ring=new THREE.Mesh(new THREE.TorusGeometry(r[0],r[1],8,120),m);
const bead=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),new THREE.MeshBasicMaterial({color:0xffffff}));bead.position.set(r[0],0,0);ring.add(bead);
const g=new THREE.Group();g.add(ring);g.rotation.x=[1.2,.5,2.1][i];g.rotation.y=i*1.4;scene.add(g);rings.push(ring);ringGroups.push(g);});
const shardGeo=new THREE.OctahedronGeometry(.15,0);
const shardMats=[0,130,260].map(o=>new THREE.MeshStandardMaterial({color:0x0a0f22,metalness:.6,roughness:.4,emissive:col(187+o,1,.6),emissiveIntensity:.8}));
const shards=[];for(let i=0;i<22;i++){const m=new THREE.Mesh(shardGeo,shardMats[i%3]);shards.push({m,r:rand(2.6,6),y:rand(-1.6,1.8),w:rand(.15,.5)*(Math.random()<.5?-1:1),a:rand(0,6.28)});scene.add(m);}
const MAXP=2000,pos=new Float32Array(MAXP*3),colArr=new Float32Array(MAXP*3),pIdx=new Uint8Array(MAXP);
for(let i=0;i<MAXP;i++){const r=3.2+Math.pow(Math.random(),.7)*6,th=rand(0,6.283);pos[i*3]=Math.cos(th)*r;pos[i*3+1]=rand(-3.5,3.5);pos[i*3+2]=Math.sin(th)*r;pIdx[i]=randi(0,2);}
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));pGeo.setAttribute('color',new THREE.BufferAttribute(colArr,3));pGeo.setDrawRange(0,P.parts);
const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.055,vertexColors:true,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));scene.add(pts);
const gc=document.createElement('canvas');gc.width=gc.height=256;const gx=gc.getContext('2d'),gr=gx.createRadialGradient(128,128,0,128,128,128);
gr.addColorStop(0,'rgba(255,255,255,.85)');gr.addColorStop(.35,'rgba(255,255,255,.28)');gr.addColorStop(1,'rgba(255,255,255,0)');gx.fillStyle=gr;gx.fillRect(0,0,256,256);
const glowMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),color:col(187,1,.6),transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});
const glow=new THREE.Sprite(glowMat);glow.scale.set(8,8,1);scene.add(glow);
let grid=null;
function buildGrid(h){if(grid){scene.remove(grid);grid.geometry.dispose();grid.material.dispose();}
grid=new THREE.GridHelper(46,46,col(h,1,.4),col(h+130,.8,.3));grid.position.y=-2.8;grid.material.transparent=true;grid.material.opacity=.22;grid.visible=P.grid;scene.add(grid);}
buildGrid(187);
function recolor(h){const a=pGeo.attributes.color,cs=[col(h,1,.62),col(h+130,1,.62),col(h+260,1,.6)];for(let i=0;i<MAXP;i++){const c=cs[pIdx[i]];a.setXYZ(i,c.r,c.g,c.b);}a.needsUpdate=true;}
recolor(187);
function resize(){const w=wrap.clientWidth||300,h=wrap.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(wrap);resize();
const el=renderer.domElement,ptrs=new Map();let pinchD=0;
el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});idleT=0;wrap.classList.add('grabbing');
if(ptrs.size===2){const a=[...ptrs.values()];pinchD=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}});
el.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;idleT=0;
if(ptrs.size===1){cam.tTheta-=dx*.0052;if(e.pointerType==='mouse')cam.tPhi=clamp(cam.tPhi-dy*.0042,.35,2.35);}
else if(ptrs.size===2){const a=[...ptrs.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchD>0&&d>0)cam.tDist=clamp(cam.tDist*(pinchD/d),5.5,15);pinchD=d;}});
const up=e=>{ptrs.delete(e.pointerId);pinchD=0;if(!ptrs.size)wrap.classList.remove('grabbing');};
el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
el.addEventListener('wheel',e=>{e.preventDefault();cam.tDist=clamp(cam.tDist*(1+e.deltaY*.0011),5.5,15);idleT=0;},{passive:false});
el.addEventListener('dblclick',()=>{cam.tTheta=.65;cam.tPhi=1.12;cam.tDist=9.4;});
return{P,
setHue(h){P.hue=h;const c1=col(h,1,.6),c2=col(h+130,1,.62),c3=col(h+260,1,.6);
wireMat.color.copy(c1);shellMat.color.copy(c2);coreMat.emissive.copy(c1);glowMat.color.copy(c1);
ringMats[0].color.copy(c1);ringMats[1].color.copy(c2);ringMats[2].color.copy(c3);
key.color.copy(c1);rim.color.copy(c2);fill.color.copy(c3);
shardMats[0].emissive.copy(c1);shardMats[1].emissive.copy(c2);shardMats[2].emissive.copy(c3);recolor(h);buildGrid(h);},
setParts(n){P.parts=n;pGeo.setDrawRange(0,n);},setSpeed(v){P.speed=v;},
setGlow(v){P.glow=v;coreMat.emissiveIntensity=.2+v*.55;},
setWire(v){P.wire=v;wire.visible=v;shell.visible=v;},setGrid(v){P.grid=v;if(grid)grid.visible=v;},setAuto(v){P.auto=v;},
pulse(v){pulse=Math.min(1.2,pulse+v);},resetView(){cam.tTheta=.65;cam.tPhi=1.12;cam.tDist=9.4;},
exportPNG(){scene.background=new THREE.Color(0x05070f);renderer.render(scene,camera);const u=renderer.domElement.toDataURL('image/png');scene.background=null;return u;},
tick(dt,t){idleT+=dt;if(P.auto&&idleT>2.2&&!ptrs.size)cam.tTheta+=dt*.11*P.speed;
const k=1-Math.exp(-8*dt);cam.theta=lerp(cam.theta,cam.tTheta,k);cam.phi=lerp(cam.phi,cam.tPhi,k);cam.dist=lerp(cam.dist,cam.tDist,k);
camera.position.setFromSphericalCoords(cam.dist,cam.phi,cam.theta);camera.lookAt(0,.1,0);
core.rotation.y+=dt*.4*P.speed;core.rotation.x=Math.sin(t*.4)*.15;
wire.rotation.y-=dt*.22*P.speed;wire.rotation.z+=dt*.1*P.speed;
shell.rotation.y+=dt*.3*P.speed;shell.rotation.x-=dt*.14*P.speed;
ringGroups.forEach((g,i)=>{g.rotation.y+=dt*(.12+i*.07)*P.speed;g.rotation.x+=Math.sin(t*.3+i)*dt*.06;});
rings.forEach((r,i)=>{r.rotation.z+=dt*(.5+i*.25)*P.speed;});
shards.forEach(s=>{s.a+=dt*s.w*P.speed;s.m.position.set(Math.cos(s.a)*s.r,s.y+Math.sin(s.a*2)*.4,Math.sin(s.a)*s.r);s.m.rotation.x+=dt*.8;s.m.rotation.y+=dt*.6;});
pts.rotation.y+=dt*.03*P.speed;pulse*=Math.exp(-3*dt);
core.scale.setScalar(1+pulse*.07);glow.scale.set(8+pulse*1.6,8+pulse*1.6,1);
glowMat.opacity=(.22+P.glow*.5)*(.85+pulse*.55)+Math.sin(t*2.1)*.02;
key.intensity=1.4+Math.sin(t*2.3)*.15+pulse*.8;renderer.render(scene,camera);}};
}catch(e){console.warn(e);return null;}}
