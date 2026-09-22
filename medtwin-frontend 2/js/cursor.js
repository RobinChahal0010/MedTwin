// Living background: a network that leans toward the cursor + glow orb + ring + magnetic buttons + tilt/spotlight cards
(()=>{const c=document.createElement('canvas');c.id='bg';document.body.prepend(c);
const orb=Object.assign(document.createElement('div'),{id:'orb'}),ring=Object.assign(document.createElement('div'),{id:'ring'});document.body.append(orb,ring);
const x=c.getContext('2d');let W,H,m={x:innerWidth/2,y:innerHeight/2},r={x:m.x,y:m.y},P=[];
const size=()=>{W=c.width=innerWidth;H=c.height=innerHeight;P=Array.from({length:Math.min(110,W/12|0)},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3}))};size();addEventListener('resize',size);
addEventListener('pointermove',e=>{m.x=e.clientX;m.y=e.clientY;orb.style.left=m.x+'px';orb.style.top=m.y+'px'});
(function loop(){r.x+=(m.x-r.x)*.18;r.y+=(m.y-r.y)*.18;ring.style.left=r.x+'px';ring.style.top=r.y+'px';x.clearRect(0,0,W,H);
for(const [pi,p] of P.entries()){const dx=m.x-p.x,dy=m.y-p.y,d=Math.hypot(dx,dy);if(d<220){p.vx+=dx/d*.012;p.vy+=dy/d*.012}p.vx*=.99;p.vy*=.99;p.x=(p.x+p.vx+W)%W;p.y=(p.y+p.vy+H)%H;
x.fillStyle=d<220?'#2f9e6e':'#9cc9ae';x.beginPath();x.arc(p.x,p.y,d<220?2.4:1.5,0,7);x.fill();
for(const [qi,q] of P.entries()){const e=Math.hypot(p.x-q.x,p.y-q.y);if(e<110&&pi<qi){x.strokeStyle=`rgba(47,158,110,${(1-e/110)*(d<220?.55:.18)})`;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}}}
requestAnimationFrame(loop)})();
const bind=()=>{document.querySelectorAll('a,button,.chip,.card').forEach(el=>{if(el._b)return;el._b=1;
el.addEventListener('pointerenter',()=>ring.classList.add('big'));el.addEventListener('pointerleave',()=>{ring.classList.remove('big');el.style.transform=''});
el.addEventListener('pointermove',e=>{const b=el.getBoundingClientRect(),px=(e.clientX-b.left)/b.width,py=(e.clientY-b.top)/b.height;
el.style.setProperty('--mx',px*100+'%');el.style.setProperty('--my',py*100+'%');
if(el.classList.contains('card'))el.style.transform=`perspective(800px) rotateY(${(px-.5)*7}deg) rotateX(${(.5-py)*7}deg)`;
else if(el.classList.contains('btn'))el.style.transform=`translate(${(px-.5)*10}px,${(py-.5)*10}px)`})})};
bind();new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});})();
