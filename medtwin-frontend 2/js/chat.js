let mode='simple',L='en',rec,stream,busy=false;
const T={en:{steps:['Understanding','Your numbers','Guidelines','What-if','Writing','Checking'],ph:'Type your question here…',sugg:['What if my sugar stays high?','What can I eat?','What if I lose weight?'],src:'Sources',sup:'Backed by sources',note:"This is not medical advice.",send:'🎙 Speak',stop:'⏹ Listening… tap to stop',v:['off','on'],vt:'Read answers aloud',sty:['Simple words','Doctor style'],st:'Style'},
 hi:{steps:['समझ रहा हूँ','आपके नंबर','दिशानिर्देश','अगर ऐसा हो','जवाब लिख रहा हूँ','जाँच'],ph:'यहाँ अपना सवाल लिखें…',sugg:['मेरा शुगर ऊँचा रहे तो?','मैं क्या खाऊँ?','वज़न घटे तो क्या होगा?'],src:'स्रोत',sup:'स्रोतों से पुष्टि',note:'यह चिकित्सा सलाह नहीं है।',send:'🎙 बोलिए',stop:'⏹ सुन रहा हूँ… रोकने के लिए दबाएँ',v:['बंद','चालू'],vt:'जवाब बोलकर सुनाएँ',sty:['आसान शब्द','डॉक्टर शैली'],st:'शैली'}};
const t=()=>T[L];
function paint(){pp.innerHTML=t().steps.map(s=>`<span>${s}</span>`).join('');q.placeholder=t().ph;lang.textContent=L=='en'?'🌐 English':'🌐 हिन्दी';
 sugg.innerHTML=t().sugg.map(s=>`<button class="chip">${s}</button>`).join('');sugg.querySelectorAll('.chip').forEach(c=>c.onclick=()=>run(c.textContent));
 voice.textContent=`🔈 ${t().vt}: ${t().v[+voice.classList.contains('on')]}`;md.textContent=`${t().st}: ${t().sty[+(mode=='doctor')]}`;mic.textContent=busy?t().stop:t().send}
lang.onclick=()=>{L=L=='en'?'hi':'en';paint()};md.onclick=()=>{mode=mode=='simple'?'doctor':'simple';paint()};
voice.onclick=()=>{voice.classList.toggle('on');if(!voice.classList.contains('on'))speechSynthesis.cancel();paint()};
const add=(c,h)=>{msgs.insertAdjacentHTML('beforeend',`<div class="m ${c}">${h}</div>`);msgs.scrollTop=1e5};
const say=x=>add('a',`<span class="mute">${x}</span>`);
const run=async s=>{add('u',s);const sp=[...pp.children];let i=0;const tm=setInterval(()=>{sp.forEach((e,k)=>e.className=k<i?'done':k==i?'on':'');i++},380);
 let r;try{r=await API.chat(s,mode,L)}catch(e){clearInterval(tm);say(L=='hi'?'सर्वर से जुड़ नहीं पाया। बैकएंड चालू है?':'Could not reach the server. Is the backend running?');return}
 clearInterval(tm);sp.forEach(e=>e.className='done');
 const src=(r.sources||[]).map(x=>`<p><b>${x.doc}</b> (${x.sec}): ${x.text}</p>`).join('');
 add('a',`${r.answer}${src?`<details><summary>${t().src} (${r.sources.length})</summary>${src}</details>`:''}<div class="bar"><i style="width:${(r.confidence||0)*100}%"></i></div><small class="mute">${t().sup}: ${Math.round((r.confidence||0)*100)}%. ${t().note}</small>`);
 if(voice.classList.contains('on'))speak(r.answer)};
f.onsubmit=e=>{e.preventDefault();if(q.value.trim()){const s=q.value;q.value='';run(s)}};
async function speak(x){try{if(CFG.live){const b=await fetch(CFG.base+'/speech/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:x,lang:L})}).then(r=>r.blob());new Audio(URL.createObjectURL(b)).play()}
 else{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(x);u.lang=L=='hi'?'hi-IN':'en-IN';speechSynthesis.speak(u)}}catch(e){console.warn(e)}}
const setMic=on=>{busy=on;mic.classList.toggle('rec',on);paint()};
mic.onclick=async()=>{
 if(busy){rec&&rec.stop();return}
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!navigator.mediaDevices&&!SR){say(L=='hi'?'माइक के लिए http://localhost या https चाहिए, फ़ाइल सीधे न खोलें।':'Mic needs http://localhost or https. Open the site through a local server.');return}
 if(CFG.live){let s;try{s=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){say(L=='hi'?'माइक की अनुमति नहीं मिली। एड्रेस बार में अनुमति दें।':'Mic blocked. Allow microphone access in the address bar.');return}
  const ch=[];rec=new MediaRecorder(s);rec.ondataavailable=e=>ch.push(e.data);
  rec.onstop=async()=>{s.getTracks().forEach(x=>x.stop());setMic(false);const fd=new FormData();fd.append('audio',new Blob(ch,{type:'audio/webm'}),'q.webm');fd.append('lang',L=='hi'?'hi-IN':'en-IN');
   try{const r=await fetch(CFG.base+'/speech/transcribe',{method:'POST',body:fd}).then(r=>r.json());r.text?run(r.text):say(L=='hi'?'कुछ सुनाई नहीं दिया।':'Could not hear anything.')}catch(e){say('Transcribe failed. Is the backend running?')}};
  rec.start();setMic(true);return}
 if(!SR){say(L=='hi'?'इस ब्राउज़र में बोलकर पूछना नहीं चलता। Chrome या Edge इस्तेमाल करें।':'Use Chrome or Edge for the mic, or add ?live for Azure Speech.');return}
 rec=new SR();rec.lang=L=='hi'?'hi-IN':'en-IN';rec.interimResults=true;let fin='';
 rec.onresult=e=>{let x='';for(const r of e.results){x+=r[0].transcript;if(r.isFinal)fin=x}q.value=x};
 rec.onerror=e=>{setMic(false);say(e.error==='not-allowed'?(L=='hi'?'माइक की अनुमति नहीं मिली।':'Mic blocked. Allow microphone access in the address bar.'):'Mic error: '+e.error)};
 rec.onend=()=>{setMic(false);const x=(fin||q.value).trim();if(x){q.value='';run(x)}};
 rec.start();setMic(true)};
paint();add('a',L=='hi'?'नमस्ते! अपना सवाल लिखें या 🎙 दबाकर बोलें।':'Hi! Type a question, or tap 🎙 and speak.');
