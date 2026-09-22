const PAGES=[['index.html','Home'],['upload.html','My numbers'],['twin.html','My health'],['chat.html','Ask a question']];
const cur=location.pathname.split('/').pop()||'index.html';
document.body.insertAdjacentHTML('afterbegin','<nav>'+PAGES.map(([h,t])=>`<a href="${h}" class="${h===cur?'on':''}">${t}</a>`).join('')+'</nav>');
document.body.insertAdjacentHTML('beforeend','<footer>This is a learning demo, not a doctor. Made for adults whose Type 2 diabetes was found at age 30 or later. Not for Type 1. Please use sample numbers only.</footer>');
const countUp=(el,to,ms=1200)=>{const t0=performance.now();(function f(t){const p=Math.min(1,(t-t0)/ms);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)})(t0)};
