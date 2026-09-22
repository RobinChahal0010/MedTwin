// MOCK by default. Live: open any page with ?live (or set localStorage.mt_live=1). Endpoints match the FastAPI backend.
const CFG={base:localStorage.mt_base||'http://localhost:8000',live:location.search.includes('live')||localStorage.mt_live==='1'};
const j=(u,o)=>fetch(u,o).then(r=>r.json());
const post=(p,b)=>j(CFG.base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
const API={
 login:async(u,p)=>CFG.live?post('/auth/login',{username:u,password:p}):{ok:!!u,patient_id:'demo'},
 twin:async()=>{const s=sessionStorage.twin;if(s)return JSON.parse(s);return CFG.live?j(`${CFG.base}/twin/${localStorage.pid||'demo'}`):j('data/twin.json')},
 upload:async(vals,file)=>{if(CFG.live){const f=new FormData();if(file)f.append('file',file);f.append('values',JSON.stringify(vals));return j(CFG.base+'/twin/upload',{method:'POST',body:f})}
  const t=await j('data/twin.json');t.values.forEach(v=>{if(vals[v.key]!=null&&vals[v.key]!=='')v.value=+vals[v.key]});return t},
 chat:async(q,mode,lang)=>{if(CFG.live)return post('/chat',{question:q,patient_id:localStorage.pid||'demo',mode:mode=='doctor'?'clinician':'patient',lang,open:true});
  const d=await j('data/chat.json');await new Promise(r=>setTimeout(r,2400));const k=d.answers.find(a=>a.match.some(w=>q.toLowerCase().includes(w)))||d.fallback;const t=(mode=='doctor'&&k.doctor)?k.doctor:k.simple;return{answer:t[lang]||t.en,sources:k.sources,confidence:k.confidence}}
};
