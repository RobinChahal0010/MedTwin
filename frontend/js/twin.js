API.twin().then(t=>{countUp(r,t.risk);setTimeout(()=>arc.style.strokeDashoffset=327*(1-t.risk/100),100);
vals.innerHTML=t.values.map(v=>`<div class="card"><div class="row" style="justify-content:space-between"><span class="mute">${v.label}</span><span class="badge ${v.status}">${v.status=='ok'?'✓ On target':'⚠ Needs attention'}</span></div>
<div class="big">${v.value}<small class="mute" style="font-size:.95rem"> ${v.unit}</small></div><p class="mute" style="font-size:.9rem">${v.goal}<br><i>Source: ${v.source}</i></p>
<div class="bar"><i data-w="${v.pct}"></i></div><p class="mute" style="font-size:.85rem">Higher than ${v.pct} out of 100 people in our data</p></div>`).join('');
setTimeout(()=>document.querySelectorAll('.bar i').forEach(b=>b.style.width=b.dataset.w+'%'),200)});
