"use strict";
/* ======================= storage ======================= */
const KEY_U="midtwin_users_v3",KEY_S="midtwin_session_v3",KEY_T="midtwin_theme_v3",KEY_L="midtwin_lang_v3";
const DB={
  get(k,f){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(e){return f}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
const users=()=>DB.get(KEY_U,{}),saveUsers=u=>DB.set(KEY_U,u);
let ME=null;
function loadMe(){const id=DB.get(KEY_S,null),all=users();ME=id&&all[id]?all[id]:null;return ME}
function saveMe(){if(!ME)return;const all=users();all[ME.id]=ME;saveUsers(all)}

/* ======================= language ======================= */
let L=DB.get(KEY_L,"en");
const NAMES={
 en:{home:"Home",numbers:"My numbers",picture:"Health picture",trends:"Trends",ask:"Ask MidTwin",diet:"Food plan",
     move:"Movement",learn:"Learn",visit:"Doctor visit",history:"History",profile:"Profile",
     out:"Sign out",ok:"On target",warn:"Worth discussing",care:"Your care",you:"You"},
 hi:{home:"होम",numbers:"मेरे नंबर",picture:"सेहत की तस्वीर",trends:"बदलाव",ask:"सवाल पूछें",diet:"खाने की योजना",
     move:"चलना-फिरना",learn:"जानिए",visit:"डॉक्टर की मुलाक़ात",history:"इतिहास",profile:"प्रोफ़ाइल",
     out:"साइन आउट",ok:"ठीक है",warn:"बात करने लायक",care:"आपकी देखभाल",you:"आप"}
};
const T=()=>NAMES[L];

/* ======================= helpers ======================= */
const $=s=>document.querySelector(s);
const el=h=>{const d=document.createElement("div");d.innerHTML=h.trim();return d.firstElementChild};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=(v,d=0)=>{const x=parseFloat(v);return isFinite(x)?x:d};
const fmtDate=ts=>new Date(ts).toLocaleString(L==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const fmtDay=ts=>new Date(ts).toLocaleDateString(L==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
const pick=(en,hi)=>L==="hi"?hi:en;
const avatar=(u,st="")=>u&&u.photo?`<img class="ava" style="${st}" src="${u.photo}" alt="">`
  :`<span class="ava" style="${st}">${esc((u&&u.name||"?").trim().charAt(0).toUpperCase())}</span>`;
const mark=(cls="mark",style="")=>`<svg class="${cls}" style="${style}" viewBox="0 0 44 40"><use href="#logo"></use></svg>`;

/* ======================= clinical fields ======================= */
const FIELDS=[
 ["age",["Your age","आपकी उम्र"],["Years","साल"],"yrs",58],
 ["height",["Height","लंबाई"],["In centimetres","सेंटीमीटर में"],"cm",165],
 ["weight",["Weight","वज़न"],["In kilograms","किलोग्राम में"],"kg",86],
 ["hba1c",["Sugar, 3-month average (HbA1c)","3 महीने का औसत शुगर (HbA1c)"],["Shown as a percentage","प्रतिशत में दिखता है"],"%",7.9],
 ["fasting",["Fasting sugar","खाली पेट शुगर"],["Morning, before eating","सुबह, कुछ खाने से पहले"],"mg/dL",146],
 ["post",["Sugar after a meal","खाने के बाद शुगर"],["Two hours after food","खाने के दो घंटे बाद"],"mg/dL",212],
 ["sbp",["Blood pressure, top number","ब्लड प्रेशर, ऊपर वाला"],["Systolic","सिस्टोलिक"],"mmHg",142],
 ["dbp",["Blood pressure, bottom number","ब्लड प्रेशर, नीचे वाला"],["Diastolic","डायस्टोलिक"],"mmHg",84],
 ["chol",["Total cholesterol","कुल कोलेस्ट्रॉल"],["From the lipid panel","लिपिड जाँच से"],"mg/dL",198],
 ["hdl",["Good cholesterol (HDL)","अच्छा कोलेस्ट्रॉल (HDL)"],["Higher is better","ज़्यादा बेहतर है"],"mg/dL",38],
 ["ldl",["Bad cholesterol (LDL)","खराब कोलेस्ट्रॉल (LDL)"],["Lower is better","कम बेहतर है"],"mg/dL",118],
 ["creat",["Kidney check (creatinine)","गुर्दे की जाँच (क्रिएटिनिन)"],["From the blood test","खून की जाँच से"],"mg/dL",1.0]
];
const blankNumbers=()=>{const o={};FIELDS.forEach(f=>o[f[0]]=f[4]);o.insulin="0";return o};
const bmiOf=nm=>{const h=n(nm.height,0)/100,w=n(nm.weight,0);return h>0?+(w/(h*h)).toFixed(1):0};

function riskOf(nm){
  const bmi=bmiOf(nm);let s=18;
  s+=(n(nm.hba1c,7)-6.2)*15;
  s+=(bmi-24)*1.5;
  s+=(n(nm.sbp,120)-125)*.22;
  s+=(n(nm.age,50)-45)*.18;
  s+=(45-n(nm.hdl,45))*.28;
  s+=(n(nm.fasting,110)-110)*.08;
  s+=(n(nm.post,140)-140)*.05;
  if(nm.insulin==="1")s+=7;
  return Math.max(4,Math.min(96,Math.round(s)));
}
const RANGE={hba1c:[5,10],fasting:[80,220],post:[100,300],sbp:[100,180],dbp:[60,110],chol:[120,280],hdl:[25,80],ldl:[50,190],creat:[.4,2],weight:[40,140],age:[20,90],height:[140,195]};
function statusOf(k,v,nm){
  switch(k){
    case"hba1c":return v<7?"ok":"warn";
    case"fasting":return v<130?"ok":"warn";
    case"post":return v<180?"ok":"warn";
    case"sbp":return v<140?"ok":"warn";
    case"dbp":return v<90?"ok":"warn";
    case"hdl":return v>=40?"ok":"warn";
    case"ldl":return v<100?"ok":"warn";
    case"chol":return v<200?"ok":"warn";
    case"creat":return v<=1.3?"ok":"warn";
    case"weight":return bmiOf(nm)<25?"ok":"warn";
    default:return"ok";
  }
}
const GOALS={
 age:["Reference only — the model uses it.","सिर्फ़ जानकारी के लिए — मॉडल इसे इस्तेमाल करता है।"],
 height:["Used with weight to work out BMI.","वज़न के साथ मिलकर BMI निकालता है।"],
 weight:["Weight goals are set with your doctor, not by a chart.","वज़न का लक्ष्य चार्ट नहीं, आपके डॉक्टर तय करते हैं।"],
 hba1c:["Under 7% suits many adults; your goal may differ.","कई वयस्कों के लिए 7% से कम; आपका लक्ष्य अलग हो सकता है।"],
 fasting:["Often looked at around 80–130 mg/dL.","आमतौर पर 80–130 mg/dL के आसपास देखा जाता है।"],
 post:["Often looked at under 180 mg/dL two hours after food.","खाने के दो घंटे बाद अक्सर 180 mg/dL से कम देखा जाता है।"],
 sbp:["Targets are individual, based on heart risk.","लक्ष्य हृदय जोखिम के हिसाब से अलग-अलग होता है।"],
 dbp:["Targets are individual, based on heart risk.","लक्ष्य हृदय जोखिम के हिसाब से अलग-अलग होता है।"],
 chol:["Read together with your overall heart risk.","आपके कुल हृदय जोखिम के साथ पढ़ा जाता है।"],
 hdl:["Under 40 mg/dL is below the usual reference.","40 mg/dL से कम सामान्य से नीचे माना जाता है।"],
 ldl:["Lower is generally better; your target depends on risk.","कम आमतौर पर बेहतर; आपका लक्ष्य जोखिम पर निर्भर।"],
 creat:["Kidneys are checked at least once a year.","गुर्दों की जाँच साल में कम से कम एक बार होती है।"]
};
const SRC={hba1c:"ADA 2026, Rec 6.3a",fasting:"ADA 2026, Sec 6",post:"ADA 2026, Sec 6",sbp:"ADA 2026, Sec 10",
 dbp:"ADA 2026, Sec 10",chol:"ADA 2026, Sec 10",hdl:"ADA 2026, Sec 10",ldl:"ADA 2026, Sec 10",
 creat:"ADA 2026, Sec 11",weight:"ADA 2026, Sec 8",age:"—",height:"—"};
const labelOf=k=>{const f=FIELDS.find(x=>x[0]===k);return f?pick(f[1][0],f[1][1]):k};
const unitOf=k=>{const f=FIELDS.find(x=>x[0]===k);return f?f[3]:""};
const pctOf=(k,v)=>{const r=RANGE[k];if(!r)return 50;return Math.max(3,Math.min(97,Math.round((v-r[0])/(r[1]-r[0])*100)))};

/* ======================= router ======================= */
const ROUTES=["home","numbers","picture","trends","ask","diet","move","learn","visit","history","profile"];
const go=r=>{location.hash="#/"+r};
const current=()=>{const h=location.hash.replace(/^#\/?/,"").split("?")[0];return ROUTES.includes(h)?h:"home"};
addEventListener("hashchange",render);

const NAV=[
 ["home","◎","you"],["picture","✧","you"],["numbers","▤","you"],["trends","◠","you"],
 ["ask","✦","care"],["diet","◍","care"],["move","➛","care"],["learn","☰","care"],["visit","✚","care"],
 ["history","↺","care"],["profile","☺","care"]
];
const TABS=["home","picture","ask","diet","profile"];

function render(){
  loadMe();
  const app=$("#app");
  if(!ME){app.innerHTML=authView();wireAuth();bindFx();return}
  const r=current();
  app.innerHTML=shell(r);
  wireShell();
  ({home:viewHome,numbers:viewNumbers,picture:viewPicture,trends:viewTrends,ask:viewAsk,diet:viewDiet,
    move:viewMove,learn:viewLearn,visit:viewVisit,history:viewHistory,profile:viewProfile}[r])($("#view"));
  bindFx();
}
function brandBlock(sub){
  return `<a class="brand" href="#/home">${mark()}<span><b>MidTwin</b>${sub?`<small>${esc(sub)}</small>`:""}</span></a>`;
}
function shell(r){
  let out="",grp="";
  NAV.forEach(([k,i,g])=>{
    if(g!==grp){grp=g;out+=`<div class="navgrp">${esc(T()[g])}</div>`}
    out+=`<a class="navlink ${k===r?"on":""}" href="#/${k}"><i>${i}</i>${esc(T()[k])}</a>`;
  });
  return `
  <div class="shell">
    <aside class="rail">
      ${brandBlock(pick("your health, in plain words","आपकी सेहत, आसान शब्दों में"))}
      ${out}
      <div class="railfoot">
        <div class="whoami">${avatar(ME)}<div style="min-width:0"><b>${esc(ME.name)}</b><span class="mute small">${esc(ME.id)}</span></div></div>
        <div class="row">
          <button class="chip" id="langBtn">🌐 ${L==="en"?"English":"हिन्दी"}</button>
          <button class="chip" id="themeBtn" title="Light or dark">◐</button>
        </div>
        <button class="chip" id="outBtn">${esc(T().out)}</button>
      </div>
    </aside>
    <div>
      <header class="topbar">
        ${brandBlock("")}
        <div class="row">
          <button class="chip" id="langBtn2">🌐 ${L==="en"?"EN":"हि"}</button>
          <button class="chip" id="themeBtn2">◐</button>
          <a href="#/profile">${avatar(ME)}</a>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div>
  </div>
  <nav class="tabbar">${TABS.map(k=>{const i=(NAV.find(x=>x[0]===k)||["","•"])[1];
    return `<a class="${k===r?"on":""}" href="#/${k}"><i>${i}</i>${esc(T()[k])}</a>`}).join("")}</nav>`;
}
function wireShell(){
  const tog=()=>{L=L==="en"?"hi":"en";DB.set(KEY_L,L);render()};
  const th=()=>{const c=document.documentElement.getAttribute("data-theme");
    const nx=c==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",nx);DB.set(KEY_T,nx)};
  ["langBtn","langBtn2"].forEach(i=>{const b=document.getElementById(i);if(b)b.onclick=tog});
  ["themeBtn","themeBtn2"].forEach(i=>{const b=document.getElementById(i);if(b)b.onclick=th});
  const o=document.getElementById("outBtn");
  if(o)o.onclick=()=>{DB.del(KEY_S);location.hash="#/home";render()};
}

/* ======================= auth (no photo here) ======================= */
let authMode="signup";
function authView(){
  const su=authMode==="signup";
  return `
  <div class="auth">
    <section class="pitch">
      ${brandBlock("")}
      <div>
        <h1>${pick("Your lab report, said in words you already use.","आपकी लैब रिपोर्ट, आपकी अपनी भाषा में।")}</h1>
        <p class="mute" style="margin-top:14px;font-size:1.06rem">${pick(
          "MidTwin turns your sugar, weight and blood pressure numbers into one clear health picture — and answers your questions in English or हिन्दी.",
          "MidTwin आपके शुगर, वज़न और ब्लड प्रेशर के नंबरों को एक साफ़ तस्वीर में बदलता है — और आपके सवालों का जवाब अंग्रेज़ी या हिन्दी में देता है।")}</p>
      </div>
      <div class="stepline">
        <div><b>1</b><p class="mute">${pick("Make an account with a username, email and password.","खाता बनाइए — यूज़रनेम, ईमेल और पासवर्ड के साथ।")}</p></div>
        <div><b>2</b><p class="mute">${pick("Put in the numbers from your lab report once. They stay saved for next time.","लैब रिपोर्ट के नंबर एक बार भरिए। अगली बार के लिए सेव रहेंगे।")}</p></div>
        <div><b>3</b><p class="mute">${pick("See where you stand, ask anything, and get a food and movement plan.","देखिए आप कहाँ खड़े हैं, कुछ भी पूछिए, और खाने-चलने की योजना पाइए।")}</p></div>
      </div>
      <p class="small mute">${pick(
        "A learning demo, not a doctor. Built around adults whose Type 2 diabetes was found at age 30 or later. Please use sample numbers only.",
        "यह सीखने का डेमो है, डॉक्टर नहीं। उन वयस्कों के लिए जिनकी टाइप 2 डायबिटीज़ 30 साल या उसके बाद पता चली। कृपया नमूना नंबर ही इस्तेमाल करें।")}</p>
      <button class="chip" id="langA" style="align-self:flex-start">🌐 ${L==="en"?"हिन्दी में देखें":"View in English"}</button>
    </section>
    <section class="formside">
      <form class="card authcard" id="authForm">
        <h2>${su?pick("Create your account","अपना खाता बनाइए"):pick("Welcome back","फिर से स्वागत है")}</h2>
        <p class="mute small" style="margin:6px 0 20px">${su?pick("Takes about thirty seconds.","लगभग तीस सेकंड लगेंगे।"):pick("Sign in to pick up where you left off.","जहाँ छोड़ा था वहीं से शुरू कीजिए।")}</p>
        ${su?`<div class="field"><label for="nm">${pick("Your name","आपका नाम")}</label><input id="nm" placeholder="${pick("E.g. Harpreet Kaur","जैसे हरप्रीत कौर")}" autocomplete="name"></div>`:""}
        <div class="field"><label for="uid">${pick("Username","यूज़रनेम")}</label><input id="uid" autocomplete="username" placeholder="${pick("Pick a short name","कोई छोटा नाम चुनिए")}"></div>
        <div class="field"><label for="em">${pick("Email","ईमेल")}</label><input id="em" type="email" autocomplete="email" placeholder="${pick("you@example.com","you@example.com")}"></div>
        <div class="field"><label for="pw">${pick("Password","पासवर्ड")}</label><input id="pw" type="password" autocomplete="${su?"new-password":"current-password"}" placeholder="${pick("At least 4 characters","कम से कम 4 अक्षर")}"></div>
        ${su?`<div class="field"><label for="pw2">${pick("Repeat password","पासवर्ड दोबारा")}</label><input id="pw2" type="password" autocomplete="new-password"></div>`:""}
        <button class="btn wide" type="submit">${su?pick("Create account","खाता बनाएँ"):pick("Sign in","साइन इन")}</button>
        <span class="err hide" id="authErr"></span>
        <p class="switch">${su?pick("Already have an account?","पहले से खाता है?"):pick("New here?","नए हैं?")}
          <button type="button" id="swap">${su?pick("Sign in","साइन इन"):pick("Create one","बना लीजिए")}</button></p>
        <p class="small mute" style="margin-top:14px;text-align:center">${pick("You can add a photo later from your profile.","फ़ोटो बाद में प्रोफ़ाइल से जोड़ सकते हैं।")}</p>
      </form>
    </section>
  </div>`;
}
function wireAuth(){
  $("#swap").onclick=()=>{authMode=authMode==="signup"?"login":"signup";render()};
  $("#langA").onclick=()=>{L=L==="en"?"hi":"en";DB.set(KEY_L,L);render()};
  $("#authForm").onsubmit=e=>{
    e.preventDefault();
    const err=$("#authErr"),fail=m=>{err.textContent=m;err.classList.remove("hide")};
    const id=$("#uid").value.trim().toLowerCase(),email=$("#em").value.trim().toLowerCase(),pw=$("#pw").value,all=users();
    const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(id.length<2)return fail(pick("Username needs at least 2 characters.","यूज़रनेम में कम से कम 2 अक्षर चाहिए।"));
    if(authMode==="signup"&&!emailOk)return fail(pick("Enter a valid email address.","एक सही ईमेल पता लिखिए।"));
    if(authMode==="login"&&email&&!emailOk)return fail(pick("That email address doesn't look right.","यह ईमेल पता सही नहीं लग रहा।"));
    if(pw.length<4)return fail(pick("Password needs at least 4 characters.","पासवर्ड में कम से कम 4 अक्षर चाहिए।"));
    if(authMode==="signup"){
      if(all[id])return fail(pick("That username is taken on this device.","यह यूज़रनेम इस डिवाइस पर पहले से है।"));
      if(Object.values(all).some(u=>u.email===email))return fail(pick("That email is already used on this device.","यह ईमेल इस डिवाइस पर पहले से इस्तेमाल हो रहा है।"));
      if(pw!==$("#pw2").value)return fail(pick("The two passwords do not match.","दोनों पासवर्ड मेल नहीं खाते।"));
      all[id]={id,email,pw,name:($("#nm").value.trim()||id),photo:"",created:Date.now(),
        profile:{sex:"female",city:"",phone:"",since:"",about:""},
        numbers:blankNumbers(),numbersSet:false,snaps:[],diet:null,dietPrefs:null,move:null,history:[],checks:{}};
      saveUsers(all);DB.set(KEY_S,id);welcome(all[id],true);
    }else{
      const found=all[id]||Object.values(all).find(u=>u.email===email);
      if(!found)return fail(pick("No account with that username or email here.","इस यूज़रनेम या ईमेल का कोई खाता यहाँ नहीं है।"));
      if(found.pw!==pw)return fail(pick("Password does not match.","पासवर्ड मेल नहीं खाता।"));
      DB.set(KEY_S,found.id);welcome(found,false);
    }
  };
}
function welcome(u,isNew){
  const w=el(`<div id="welcome"><div class="in">
    ${mark("mark")}
    <h1>${pick("Welcome to MidTwin,","MidTwin में स्वागत है,")} ${esc(u.name.split(" ")[0])}.</h1>
    <p class="mute" style="margin:14px auto 24px">${isNew
      ?pick("Your account is ready. Next step: put in the numbers from your lab report — once, and they stay saved.","आपका खाता तैयार है। अगला कदम: लैब रिपोर्ट के नंबर भरिए — एक बार, फिर सेव रहेंगे।")
      :pick("Good to see you again. Your numbers, plans and past questions are where you left them.","फिर मिलकर अच्छा लगा। आपके नंबर, योजनाएँ और पुराने सवाल वहीं हैं।")}</p>
    <button class="btn" id="wgo">${isNew?pick("Add my numbers","मेरे नंबर भरें"):pick("Go to my health picture","मेरी सेहत की तस्वीर")}</button>
  </div></div>`);
  document.body.appendChild(w);
  const done=()=>{if(!document.body.contains(w))return;w.remove();location.hash=isNew?"#/numbers":"#/home";render()};
  w.querySelector("#wgo").onclick=done;
  setTimeout(done,4200);
}

/* ======================= home ======================= */
function viewHome(host){
  const nm=ME.numbers,risk=riskOf(nm),bmi=bmiOf(nm),h=new Date().getHours();
  const hi=h<12?pick("Good morning","सुप्रभात"):h<17?pick("Good afternoon","नमस्कार"):pick("Good evening","शुभ संध्या");
  const keys=["hba1c","fasting","post","sbp","weight","hdl","ldl","creat"];
  const warns=keys.filter(k=>statusOf(k,n(nm[k]),nm)==="warn");
  const last=(ME.history||[]).slice(-3).reverse();
  const C=2*Math.PI*52;
  host.innerHTML=`
  <p class="eyebrow">${hi}, ${esc(ME.name.split(" ")[0])}</p>
  <h1>${pick("Your health picture","आपकी सेहत की तस्वीर")}</h1>
  <p class="mute" style="margin-top:8px">${pick(
    "Green means on target. Orange means it is worth a conversation with your doctor — not that something is wrong today.",
    "हरा मतलब लक्ष्य पर। नारंगी मतलब डॉक्टर से बात करने लायक — यह नहीं कि आज कुछ गड़बड़ है।")}</p>
  ${!ME.numbersSet?`<div class="note" style="margin-top:18px">${pick("These are sample numbers.","ये नमूना नंबर हैं।")} <a href="#/numbers">${pick("Put in your own","अपने नंबर भरिए")}</a>.</div>`:""}

  <div class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
    <div class="card" style="text-align:center">
      <svg viewBox="0 0 120 120" width="196" height="196" style="margin:0 auto;display:block">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--soft)" stroke-width="11"/>
        <circle id="arc" cx="60" cy="60" r="52" fill="none" stroke="var(--g)" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${C.toFixed(0)}" stroke-dashoffset="${C.toFixed(0)}" transform="rotate(-90 60 60)"
          style="transition:stroke-dashoffset 1.5s cubic-bezier(.2,.8,.2,1)"/>
        <text id="rtxt" x="60" y="67" text-anchor="middle" font-family="Fraunces,serif" font-size="27" fill="var(--ink)">0%</text>
      </svg>
      <p class="mute small" style="margin:10px auto 18px;max-width:34ch">${pick(
        "Estimated chance your sugar stays above the usual goal. An estimate from many people's data, not a diagnosis.",
        "अनुमान कि आपका शुगर सामान्य लक्ष्य से ऊपर रहेगा। यह बहुत से लोगों के डेटा से निकला अनुमान है, निदान नहीं।")}</p>
      <div class="row" style="justify-content:center"><a class="btn" href="#/ask">${pick("Ask a question","सवाल पूछें")}</a><a class="btn ghost" href="#/picture">${pick("See details","विस्तार से")}</a></div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="row between"><h2>${pick("What stands out","क्या ध्यान खींचता है")}</h2><span class="badge ${warns.length?"warn":"ok"}">${warns.length} ${pick("to discuss","बात करने लायक")}</span></div>
        <hr class="sep">
        ${warns.length?warns.map(k=>`<p style="margin-bottom:11px"><b>${esc(labelOf(k))}</b> — ${esc(nm[k])} ${esc(unitOf(k))}. <span class="mute">${esc(pick(GOALS[k][0],GOALS[k][1]))}</span></p>`).join("")
          :`<p class="mute">${pick("Everything you entered sits inside the usual reference ranges.","आपने जो भरा है, सब सामान्य दायरे में है।")}</p>`}
      </div>
      <div class="grid g-auto">
        ${tile(pick("BMI","BMI"),bmi||"—","kg/m²",bmi&&bmi<25?"ok":"warn")}
        ${tile(pick("Sugar average","औसत शुगर"),nm.hba1c,"%",statusOf("hba1c",n(nm.hba1c),nm))}
        ${tile(pick("Blood pressure","ब्लड प्रेशर"),nm.sbp+"/"+nm.dbp,"mmHg",statusOf("sbp",n(nm.sbp),nm))}
      </div>
    </div>
  </div>

  <h2 style="margin:30px 0 14px">${pick("Where to go next","आगे कहाँ जाएँ")}</h2>
  <div class="grid g-auto">
    ${navCard("diet",pick("My food plan","खाने की योजना"),pick("A week of meals built from what you actually eat.","आपकी रोज़ की थाली से बना पूरे हफ़्ते का खाना।"))}
    ${navCard("move",pick("Movement plan","चलने-फिरने की योजना"),pick("A week of walking and simple strength work.","हफ़्ते भर की सैर और आसान ताक़त वाली कसरत।"))}
    ${navCard("trends",pick("Trends","बदलाव"),pick("Watch your numbers move across visits.","देखिए आपके नंबर मुलाक़ातों के बीच कैसे बदले।"))}
    ${navCard("learn",pick("Learn","जानिए"),pick("Short, plain explanations of every term here.","यहाँ के हर शब्द की छोटी, आसान समझ।"))}
    ${navCard("visit",pick("Doctor visit","डॉक्टर की मुलाक़ात"),pick("A page you can print and carry with you.","एक पन्ना जो छापकर साथ ले जा सकते हैं।"))}
    ${navCard("history",pick("History","इतिहास"),pick("Everything you have asked, kept for you.","आपके सारे पुराने सवाल, सहेजे हुए।"))}
  </div>

  <div class="card" style="margin-top:18px">
    <div class="row between"><h3>${pick("Recent questions","हाल के सवाल")}</h3><a class="small" href="#/history">${pick("See all","सब देखें")}</a></div>
    <hr class="sep">
    ${last.length?last.map(x=>`<p style="margin-bottom:9px">“${esc(x.q)}”<br><span class="mute small">${fmtDate(x.t)}</span></p>`).join("")
      :`<p class="mute">${pick("Nothing yet. Your questions and answers will be kept here.","अभी कुछ नहीं। आपके सवाल-जवाब यहाँ रखे जाएँगे।")}</p>`}
  </div>`;
  requestAnimationFrame(()=>{
    const arc=document.getElementById("arc");
    if(arc)arc.style.strokeDashoffset=(C*(1-risk/100)).toFixed(0);
    countUp(document.getElementById("rtxt"),risk);
  });
}
const navCard=(r,t,d)=>`<a class="card link" href="#/${r}"><h3>${esc(t)}</h3><p class="mute small" style="margin-top:6px">${esc(d)}</p></a>`;
function tile(label,val,unit,st){
  return `<div class="card"><div class="row between"><span class="mute small">${esc(label)}</span>
    <span class="badge ${st}">${st==="ok"?"✓ "+T().ok:"⚠ "+T().warn}</span></div>
    <div class="num" style="margin-top:10px">${esc(val)}<span class="mute" style="font-size:.9rem"> ${esc(unit)}</span></div></div>`;
}
function countUp(elm,to,ms=1100){
  if(!elm)return;const t0=performance.now();
  (function f(t){const p=Math.min(1,(t-t0)/ms);elm.textContent=Math.round(to*(1-Math.pow(1-p,3)))+"%";if(p<1)requestAnimationFrame(f)})(t0);
}

/* ======================= health picture ======================= */
function viewPicture(host){
  const nm=ME.numbers;
  host.innerHTML=`
  <h1>${pick("Every number, explained","हर नंबर, समझाया हुआ")}</h1>
  <p class="mute" style="margin-top:8px">${pick(
    "Each card shows your value, what it is usually compared against, and where the comparison comes from.",
    "हर कार्ड में आपका नंबर, उसकी सामान्य तुलना, और वह तुलना कहाँ से आई — तीनों हैं।")}</p>
  <div class="grid g-auto" style="margin-top:22px">
    ${FIELDS.filter(f=>!["age","height"].includes(f[0])).map(([k,l,,u])=>{
      const v=n(nm[k]),st=statusOf(k,v,nm),p=pctOf(k,v);
      return `<div class="card">
        <div class="row between"><span class="mute small">${esc(pick(l[0],l[1]))}</span><span class="badge ${st}">${st==="ok"?"✓ "+T().ok:"⚠ "+T().warn}</span></div>
        <div class="num" style="margin-top:10px">${esc(nm[k])}<span class="mute" style="font-size:.88rem"> ${esc(u)}</span></div>
        <p class="mute small" style="margin-top:8px">${esc(pick(GOALS[k][0],GOALS[k][1]))}</p>
        <div class="bar"><i data-w="${p}"></i></div>
        <p class="mute small" style="margin-top:7px">${pick("Sits around the "+p+"th mark of the usual reported range.","सामान्य दायरे में लगभग "+p+"वें निशान पर।")}<br><i>${pick("Source","स्रोत")}: ${esc(SRC[k]||"—")}</i></p>
      </div>`}).join("")}
  </div>
  <div class="row" style="margin-top:20px"><a class="btn" href="#/numbers">${pick("Update these numbers","ये नंबर बदलें")}</a>
    <a class="btn ghost" href="#/ask">${pick("Ask about one of them","इनमें से किसी के बारे में पूछें")}</a></div>`;
  requestAnimationFrame(()=>host.querySelectorAll(".bar i").forEach(b=>b.style.width=b.dataset.w+"%"));
}

/* ======================= numbers ======================= */
function viewNumbers(host){
  const nm=ME.numbers;
  host.innerHTML=`
  <h1>${pick("Your numbers","आपके नंबर")}</h1>
  <p class="mute" style="margin-top:8px">${pick(
    "Copy them from your lab report. They are saved on this device, so you only do this once — and every save is kept as a snapshot for your trends.",
    "लैब रिपोर्ट से उतार लीजिए। ये इसी डिवाइस पर सेव होते हैं, इसलिए एक ही बार भरना है — और हर सेव आपके बदलाव पेज के लिए सहेजा जाता है।")}</p>
  <div class="drop" id="dz" style="margin:20px 0">
    <p>${pick("Have the report as a file? Drop it here, or","रिपोर्ट फ़ाइल में है? यहाँ छोड़िए, या")}
      <label style="color:var(--g2);text-decoration:underline;display:inline">${pick("choose a file","फ़ाइल चुनिए")}<input id="fi" type="file" hidden></label></p>
    <p class="mute small" id="fn" style="margin-top:6px">${pick("Nothing attached. This demo keeps the file name only — nothing is uploaded.","कुछ नहीं जुड़ा। यह डेमो सिर्फ़ फ़ाइल का नाम रखता है — कुछ अपलोड नहीं होता।")}</p>
  </div>
  <form class="card" id="numForm">
    <div class="grid g-auto">
      ${FIELDS.map(([k,l,h,u])=>`<div class="field"><label for="${k}">${esc(pick(l[0],l[1]))}</label>
        <input id="${k}" name="${k}" type="number" step="any" value="${esc(nm[k])}">
        <span class="hint">${esc(pick(h[0],h[1]))} · ${esc(u)}</span></div>`).join("")}
      <div class="field"><label for="insulin">${pick("Do you take insulin?","क्या आप इंसुलिन लेते हैं?")}</label>
        <select id="insulin" name="insulin"><option value="0"${nm.insulin==="0"?" selected":""}>${pick("No","नहीं")}</option>
        <option value="1"${nm.insulin==="1"?" selected":""}>${pick("Yes","हाँ")}</option></select>
        <span class="hint">${pick("Used by the risk estimate only.","सिर्फ़ जोखिम अनुमान में इस्तेमाल होता है।")}</span></div>
    </div>
    <span class="err hide" id="numErr"></span>
    <div class="row" style="margin-top:16px">
      <button class="btn" type="submit">${pick("Save and see my picture","सेव करके तस्वीर देखें")}</button>
      <button class="btn ghost" type="button" id="reset">${pick("Put the sample numbers back","नमूना नंबर वापस लाएँ")}</button>
    </div>
  </form>`;
  const fi=$("#fi"),fn=$("#fn"),dz=$("#dz");
  const shown=f=>{if(f)fn.textContent=pick("Attached: ","जुड़ी फ़ाइल: ")+f.name};
  fi.onchange=()=>shown(fi.files[0]);
  dz.ondragover=e=>{e.preventDefault();dz.classList.add("hov")};
  dz.ondragleave=()=>dz.classList.remove("hov");
  dz.ondrop=e=>{e.preventDefault();dz.classList.remove("hov");shown(e.dataTransfer.files[0])};
  $("#reset").onclick=()=>{ME.numbers=blankNumbers();ME.numbersSet=false;saveMe();render()};
  $("#numForm").onsubmit=e=>{
    e.preventDefault();
    const v=Object.fromEntries(new FormData(e.target)),err=$("#numErr");
    const bad=
      n(v.hba1c)<3||n(v.hba1c)>20?pick("HbA1c is usually between 3 and 20%.","HbA1c आमतौर पर 3 से 20% के बीच होता है।"):
      n(v.sbp)<60||n(v.sbp)>300?pick("The top blood pressure number looks out of range.","ऊपर वाला ब्लड प्रेशर नंबर दायरे से बाहर लग रहा है।"):
      n(v.height)<80||n(v.height)>240?pick("Height should be in centimetres, e.g. 165.","लंबाई सेंटीमीटर में लिखें, जैसे 165।"):
      n(v.weight)<20||n(v.weight)>300?pick("Weight should be in kilograms, e.g. 72.","वज़न किलोग्राम में लिखें, जैसे 72।"):"";
    if(bad){err.textContent=bad;err.classList.remove("hide");return}
    ME.numbers=Object.assign(blankNumbers(),v);
    ME.numbersSet=true;ME.diet=null;ME.move=null;
    ME.snaps=(ME.snaps||[]).concat({t:Date.now(),hba1c:n(v.hba1c),fasting:n(v.fasting),sbp:n(v.sbp),
      weight:n(v.weight),bmi:bmiOf(ME.numbers),risk:riskOf(ME.numbers)}).slice(-24);
    saveMe();go("picture");
  };
}

/* ======================= trends ======================= */
function viewTrends(host){
  const s=ME.snaps||[];
  host.innerHTML=`
  <h1>${pick("How your numbers move","आपके नंबर कैसे बदले")}</h1>
  <p class="mute" style="margin-top:8px">${pick(
    "Every time you save your numbers, MidTwin keeps a snapshot. Two or more snapshots make a line you can read.",
    "जब भी आप नंबर सेव करते हैं, MidTwin एक स्नैपशॉट रख लेता है। दो या उससे ज़्यादा स्नैपशॉट से लाइन बनती है।")}</p>
  ${s.length<2?`<div class="card" style="margin-top:22px"><p class="mute">${pick(
      "Only "+s.length+" snapshot so far. Save your numbers again after your next lab report and the lines will appear here.",
      "अभी सिर्फ़ "+s.length+" स्नैपशॉट है। अगली रिपोर्ट के बाद नंबर दोबारा सेव कीजिए, फिर लाइनें यहाँ दिखेंगी।")}</p>
      <div class="row" style="margin-top:14px"><a class="btn" href="#/numbers">${pick("Go to my numbers","मेरे नंबर")}</a></div></div>`
  :`<div class="grid g-2" style="margin-top:22px">
      ${chartCard(pick("Sugar average (HbA1c)","औसत शुगर (HbA1c)"),s.map(x=>x.hba1c),"%",7)}
      ${chartCard(pick("Model score","मॉडल स्कोर"),s.map(x=>x.risk),"%")}
      ${chartCard(pick("Weight","वज़न"),s.map(x=>x.weight),"kg")}
      ${chartCard(pick("Blood pressure, top","ब्लड प्रेशर, ऊपर"),s.map(x=>x.sbp),"mmHg",140)}
    </div>
    <div class="card" style="margin-top:18px"><h3>${pick("Every snapshot","सारे स्नैपशॉट")}</h3><hr class="sep">
      <div class="scroll-x"><table>
        <tr><th>${pick("When","कब")}</th><th>HbA1c</th><th>${pick("Fasting","खाली पेट")}</th><th>${pick("BP top","BP ऊपर")}</th><th>${pick("Weight","वज़न")}</th><th>BMI</th><th>${pick("Score","स्कोर")}</th></tr>
        ${s.slice().reverse().map(x=>`<tr><td>${fmtDate(x.t)}</td><td>${x.hba1c}%</td><td>${x.fasting}</td><td>${x.sbp}</td><td>${x.weight} kg</td><td>${x.bmi}</td><td>${x.risk}%</td></tr>`).join("")}
      </table></div>
      <div class="row" style="margin-top:14px"><button class="chip" id="clrS">${pick("Clear snapshots","स्नैपशॉट मिटाएँ")}</button></div></div>`}`;
  const c=$("#clrS");
  if(c)c.onclick=()=>{if(confirm(pick("Delete all saved snapshots?","सारे सहेजे स्नैपशॉट मिटा दें?"))){ME.snaps=[];saveMe();render()}};
}
function chartCard(title,vals,unit,goal){
  const w=420,h=150,pad=10;
  const mn=Math.min(...vals,goal!=null?goal:Infinity),mx=Math.max(...vals,goal!=null?goal:-Infinity);
  const lo=mn-(mx-mn||1)*.25,hiv=mx+(mx-mn||1)*.25;
  const X=i=>pad+i*(w-2*pad)/Math.max(1,vals.length-1);
  const Y=v=>h-pad-((v-lo)/(hiv-lo||1))*(h-2*pad);
  const pts=vals.map((v,i)=>X(i).toFixed(1)+","+Y(v).toFixed(1)).join(" ");
  const area=`${pad},${h-pad} ${pts} ${(w-pad)},${h-pad}`;
  const delta=vals.length>1?+(vals[vals.length-1]-vals[0]).toFixed(1):0;
  return `<div class="card">
    <div class="row between"><span class="mute small">${esc(title)}</span>
      <span class="badge ${delta<=0?"ok":"warn"}">${delta>0?"+":""}${delta} ${esc(unit)}</span></div>
    <div class="num" style="margin:10px 0 6px">${vals[vals.length-1]}<span class="mute" style="font-size:.86rem"> ${esc(unit)}</span></div>
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="140" preserveAspectRatio="none" style="overflow:visible">
      <polygon points="${area}" fill="color-mix(in srgb,var(--g) 13%,transparent)"/>
      ${goal!=null?`<line x1="${pad}" y1="${Y(goal).toFixed(1)}" x2="${w-pad}" y2="${Y(goal).toFixed(1)}" stroke="var(--warn)" stroke-width="1.4" stroke-dasharray="5 5"/>`:""}
      <polyline points="${pts}" fill="none" stroke="var(--g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${vals.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.6" fill="var(--panel)" stroke="var(--g)" stroke-width="2.2"/>`).join("")}
    </svg>
    ${goal!=null?`<p class="mute small" style="margin-top:8px">${pick("Dashed line is the usual reference of "+goal+" "+unit+".","बिंदुओं वाली लाइन सामान्य संदर्भ "+goal+" "+unit+" है।")}</p>`:""}
  </div>`;
}

/* ======================= knowledge engine ======================= */
/* Small retrieval model: each intent has weighted trigger terms in both languages.
   The query is scored against every intent; the best score above the floor answers. */
const KB=[
 {id:"greet",w:{"hello":3,"hi":2,"hii":3,"hey":2,"namaste":3,"नमस्ते":3,"नमस्कार":3,"हैलो":3,"kaise ho":2},conf:1,
  en:g=>`Hello ${g.first}. I can explain your sugar, weight, blood pressure, cholesterol, kidney check, food, movement or the model score. Ask in whichever language is easier.`,
  hi:g=>`नमस्ते ${g.first}। मैं आपका शुगर, वज़न, ब्लड प्रेशर, कोलेस्ट्रॉल, गुर्दों की जाँच, खाना, चलना-फिरना या मॉडल स्कोर समझा सकता हूँ। जो भाषा आसान लगे, उसी में पूछिए।`},

 {id:"hba1c",w:{"hba1c":4,"a1c":4,"sugar":2,"average":2,"शुगर":2,"चीनी":2,"औसत":2,"महीने":2,"three month":3,"तीन महीने":3},conf:.93,
  src:[["ADA Standards of Care 2026","Rec 6.3a","An A1C goal under 7% suits many nonpregnant adults who do not have significant low-sugar episodes."]],
  en:g=>`Your three-month sugar average is ${g.nm.hba1c}%. For many adults the usual goal is under 7%, though your doctor may set a different one — older age, other illnesses or frequent low sugars all shift it. With today's numbers the model puts the chance of staying above that goal near ${g.risk}%. HbA1c reflects the last eight to twelve weeks, so a change you make now shows up at the next test, not this week.`,
  hi:g=>`आपका तीन महीने का औसत शुगर ${g.nm.hba1c}% है। कई वयस्कों के लिए सामान्य लक्ष्य 7% से कम रहता है, पर आपके डॉक्टर अलग लक्ष्य तय कर सकते हैं — ज़्यादा उम्र, दूसरी बीमारियाँ या बार-बार शुगर गिरना, सब इसे बदल देते हैं। आज के नंबरों पर मॉडल के अनुसार लक्ष्य से ऊपर रहने की संभावना लगभग ${g.risk}% है। HbA1c पिछले आठ से बारह हफ़्तों को दिखाता है, इसलिए आज किया बदलाव अगली जाँच में दिखेगा, इसी हफ़्ते नहीं।`},

 {id:"fasting",w:{"fasting":4,"khali pet":4,"खाली पेट":4,"morning sugar":3,"सुबह शुगर":3,"empty stomach":3},conf:.85,
  src:[["ADA Standards of Care 2026","Sec 6","Fasting glucose is often looked at in the 80–130 mg/dL range for many nonpregnant adults."]],
  en:g=>`Your fasting sugar is ${g.nm.fasting} mg/dL. For many adults this is looked at around 80 to 130 mg/dL. A high morning reading often has nothing to do with dinner — it can be the liver releasing sugar overnight, which is why doctors look at the pattern across several mornings rather than one number.`,
  hi:g=>`आपका खाली पेट शुगर ${g.nm.fasting} mg/dL है। कई वयस्कों में इसे 80 से 130 mg/dL के आसपास देखा जाता है। सुबह का ऊँचा नंबर अक्सर रात के खाने से नहीं होता — रातभर लिवर से निकलने वाली शुगर भी वजह हो सकती है, इसीलिए डॉक्टर एक नंबर नहीं, कई सुबहों का पैटर्न देखते हैं।`},

 {id:"post",w:{"after meal":4,"after eating":4,"post":2,"खाने के बाद":4,"भोजन के बाद":3,"spike":3,"उछाल":3},conf:.83,
  src:[["ADA Standards of Care 2026","Sec 6","Glucose two hours after a meal is often looked at under 180 mg/dL."]],
  en:g=>`Your reading two hours after food is ${g.nm.post} mg/dL, and under 180 is the figure usually quoted for adults. What lifts it most is the amount of carbohydrate in one sitting, not sweetness alone — a large plate of rice can move it more than a small sweet. Eating vegetables and dal before the rice, and a ten-minute walk after, both flatten that rise.`,
  hi:g=>`खाने के दो घंटे बाद आपका नंबर ${g.nm.post} mg/dL है, और वयस्कों के लिए आमतौर पर 180 से कम बताया जाता है। इसे सबसे ज़्यादा एक बार में खाए गए कार्बोहाइड्रेट की मात्रा बढ़ाती है, सिर्फ़ मिठास नहीं — चावल की बड़ी थाली छोटी मिठाई से ज़्यादा असर कर सकती है। चावल से पहले सब्ज़ी और दाल खाना, और बाद में दस मिनट टहलना, दोनों इस उछाल को कम करते हैं।`},

 {id:"weight",w:{"weight":4,"bmi":4,"वजन":4,"वज़न":4,"मोटा":3,"मोटापा":3,"lose":2,"घटाना":3,"kam":1},conf:.88,
  src:[["ADA Standards of Care 2026","Sec 8","Weight management is a core part of type 2 diabetes care."]],
  en:g=>`Your BMI works out to ${g.bmi} from ${g.nm.height} cm and ${g.nm.weight} kg. If it came down to 28, the model score moves from about ${g.risk}% to ${Math.max(4,g.risk-7)}%. Even five to ten percent of body weight — for you roughly ${Math.round(g.nm.weight*.07)} kg — is the range where sugar and blood pressure usually start to shift. A safe pace is something to agree with your doctor, especially if you are on medicines that can drop sugar.`,
  hi:g=>`${g.nm.height} सेमी और ${g.nm.weight} किलो से आपका BMI ${g.bmi} बनता है। अगर यह 28 तक आ जाए तो मॉडल स्कोर लगभग ${g.risk}% से ${Math.max(4,g.risk-7)}% हो जाता है। शरीर के वज़न का पाँच से दस प्रतिशत भी — आपके लिए करीब ${Math.round(g.nm.weight*.07)} किलो — वह दायरा है जहाँ शुगर और ब्लड प्रेशर बदलने लगते हैं। सुरक्षित रफ़्तार डॉक्टर के साथ तय कीजिए, ख़ासकर अगर ऐसी दवा चल रही हो जो शुगर गिरा सकती है।`},

 {id:"bp",w:{"bp":4,"blood pressure":4,"pressure":3,"बीपी":4,"प्रेशर":3,"रक्तचाप":4,"hypertension":3},conf:.84,
  src:[["ADA Standards of Care 2026","Sec 10","Blood pressure targets are individualised using cardiovascular risk."]],
  en:g=>`Your blood pressure is ${g.nm.sbp} over ${g.nm.dbp}. ${n(g.nm.sbp)>=140?"The top number sits in the range that is usually acted on.":"Both numbers are inside the usual reference here."} Targets are set person by person from heart risk, so ask your doctor what yours should be. One reading rarely decides anything — readings taken at home, sitting quietly, arm supported, across a week are what count.`,
  hi:g=>`आपका ब्लड प्रेशर ${g.nm.sbp}/${g.nm.dbp} है। ${n(g.nm.sbp)>=140?"ऊपर वाला नंबर उस दायरे में है जिस पर आमतौर पर कदम उठाया जाता है।":"दोनों नंबर यहाँ सामान्य दायरे में हैं।"} लक्ष्य हर व्यक्ति के हृदय जोखिम से तय होता है, इसलिए अपना लक्ष्य डॉक्टर से पूछिए। एक रीडिंग से कुछ तय नहीं होता — घर पर, शांति से बैठकर, हाथ टिकाकर, हफ़्ते भर ली गई रीडिंग मायने रखती हैं।`},

 {id:"chol",w:{"cholesterol":4,"hdl":4,"ldl":4,"lipid":3,"कोलेस्ट्रॉल":4,"चर्बी":2},conf:.8,
  src:[["ADA Standards of Care 2026","Sec 10","Lipids are assessed alongside overall cardiovascular risk."]],
  en:g=>`Total cholesterol ${g.nm.chol} mg/dL, good cholesterol (HDL) ${g.nm.hdl} mg/dL, bad cholesterol (LDL) ${g.nm.ldl} mg/dL. HDL under 40 is below the usual reference; LDL is the one most decisions are built around. Cholesterol is never read on its own — it is weighed together with your age, blood pressure and sugar to work out heart risk, which is why two people with the same LDL can get different advice.`,
  hi:g=>`कुल कोलेस्ट्रॉल ${g.nm.chol} mg/dL, अच्छा कोलेस्ट्रॉल (HDL) ${g.nm.hdl} mg/dL, खराब कोलेस्ट्रॉल (LDL) ${g.nm.ldl} mg/dL। 40 से कम HDL सामान्य से नीचे है; ज़्यादातर फ़ैसले LDL के आसपास बनते हैं। कोलेस्ट्रॉल कभी अकेले नहीं पढ़ा जाता — इसे उम्र, ब्लड प्रेशर और शुगर के साथ तौलकर हृदय जोखिम निकाला जाता है, इसीलिए एक जैसे LDL वाले दो लोगों को अलग सलाह मिल सकती है।`},

 {id:"kidney",w:{"kidney":4,"creatinine":4,"गुर्दा":4,"गुर्दे":4,"किडनी":4,"urine":2,"पेशाब":3,"egfr":3},conf:.82,
  src:[["ADA Standards of Care 2026","Sec 11","Kidney function is assessed at least annually in type 2 diabetes."]],
  en:g=>`Your creatinine is ${g.nm.creat} mg/dL, inside the usual reference. In type 2 diabetes kidneys are checked at least once a year with two tests together: this blood test, and a urine test for protein. The urine one often changes first, which is why it is worth asking whether it was done — a normal creatinine alone does not rule everything out.`,
  hi:g=>`आपका क्रिएटिनिन ${g.nm.creat} mg/dL है, सामान्य दायरे में। टाइप 2 डायबिटीज़ में गुर्दों की जाँच साल में कम से कम एक बार, दो टेस्ट साथ में होती है: यह खून वाला, और पेशाब में प्रोटीन वाला। पेशाब वाला अक्सर पहले बदलता है, इसलिए पूछना बनता है कि वह हुआ या नहीं — सिर्फ़ सामान्य क्रिएटिनिन से सब साफ़ नहीं हो जाता।`},

 {id:"food",w:{"eat":3,"food":4,"diet":4,"khana":4,"खाना":4,"खाने":3,"आहार":4,"भोजन":3,"rice":3,"चावल":3,"roti":3,"रोटी":3,"meal":2},conf:.78,
  src:[["ADA Standards of Care 2026","Sec 5","Nutrition therapy should be individualised for each person."]],
  en:g=>`Food plans work when they are built around what you already cook, not around a list you will abandon. Yours is ready — open the food plan page and it lays out the week meal by meal, with portions worked from your height, weight, age and activity. The three changes that move sugar most: half the plate vegetables, dal or paneer or egg at every meal, and eating the rice or roti last rather than first.`,
  hi:g=>`खाने की योजना तभी चलती है जब वह आपकी रोज़ की रसोई पर बने, किसी ऐसी सूची पर नहीं जो आप छोड़ देंगे। आपकी तैयार है — खाने की योजना पेज खोलिए, वहाँ पूरा हफ़्ता खाने-दर-खाने रखा है, और हिस्से आपकी लंबाई, वज़न, उम्र और गतिविधि से निकले हैं। शुगर पर सबसे ज़्यादा असर करने वाले तीन बदलाव: आधी थाली सब्ज़ी, हर खाने में दाल या पनीर या अंडा, और चावल-रोटी सबसे आख़िर में खाना।`},

 {id:"exercise",w:{"exercise":4,"walk":4,"workout":4,"gym":3,"व्यायाम":4,"कसरत":4,"चलना":3,"सैर":4,"टहलना":3,"yoga":3,"योग":3},conf:.8,
  src:[["ADA Standards of Care 2026","Sec 5","Regular physical activity is encouraged for adults with diabetes."]],
  en:g=>`About 150 minutes of moderate activity a week is the usual suggestion — brisk walking counts, and splitting it into 20 to 30 minute pieces works just as well as one long session. Two days of simple strength work are suggested alongside it. A ten-minute walk after your largest meal is the single highest-value habit here. Your movement plan page has the week laid out. Check with your doctor first, especially with your blood pressure at ${g.nm.sbp}.`,
  hi:g=>`हफ़्ते में लगभग 150 मिनट की मध्यम गतिविधि आम सुझाव है — तेज़ चलना भी गिना जाता है, और इसे 20 से 30 मिनट के हिस्सों में बाँटना एक लंबी बैठक जितना ही काम करता है। साथ में दो दिन आसान ताक़त वाली कसरत सुझाई जाती है। सबसे ज़्यादा फ़ायदा देने वाली एक आदत: सबसे बड़े खाने के बाद दस मिनट की सैर। चलने-फिरने की योजना पेज पर पूरा हफ़्ता रखा है। पहले डॉक्टर से पूछ लीजिए, ख़ासकर ${g.nm.sbp} के ब्लड प्रेशर के साथ।`},

 {id:"medicine",w:{"medicine":4,"dawa":4,"दवा":4,"दवाई":4,"गोली":3,"tablet":3,"metformin":4,"insulin":4,"इंसुलिन":4,"dose":3,"खुराक":3},conf:.72,
  en:g=>`I cannot suggest, change or stop a medicine — that belongs to your doctor, who can see your full history and the rest of your tests. What I can do is get you ready for the visit. Take these three: sugar average ${g.nm.hba1c}%, blood pressure ${g.nm.sbp}/${g.nm.dbp}, BMI ${g.bmi}. The doctor-visit page prints all of it on one sheet, with the questions worth asking.`,
  hi:g=>`दवा सुझाना, बदलना या रोकना मेरे बस में नहीं — यह आपके डॉक्टर का काम है, जिनके पास आपका पूरा इतिहास और बाकी जाँचें हैं। मैं मुलाक़ात की तैयारी करा सकता हूँ। ये तीन ले जाइए: औसत शुगर ${g.nm.hba1c}%, ब्लड प्रेशर ${g.nm.sbp}/${g.nm.dbp}, BMI ${g.bmi}। डॉक्टर की मुलाक़ात पेज यह सब एक पन्ने पर छाप देता है, पूछने लायक सवालों के साथ।`},

 {id:"low",w:{"low sugar":4,"hypo":4,"hypoglyc":4,"shaky":3,"कम शुगर":4,"शुगर गिर":4,"चक्कर":3,"कमजोरी":2,"पसीना":2},conf:.8,
  src:[["ADA Standards of Care 2026","Sec 6","People at risk of hypoglycaemia should be asked about it at every visit."]],
  en:g=>`Low sugar usually shows up as shaking, sweating, sudden hunger, a racing heart or confusion. The standard response is fifteen grams of fast sugar — glucose tablets, a few spoons of sugar or plain juice — then a recheck after fifteen minutes. It matters more if you are on insulin or a sulfonylurea. If it happens often, tell your doctor, because it usually means a dose needs rethinking rather than that you did something wrong.`,
  hi:g=>`शुगर गिरने पर आमतौर पर कँपकँपी, पसीना, अचानक भूख, दिल की तेज़ धड़कन या उलझन होती है। सामान्य जवाब है पंद्रह ग्राम तेज़ शुगर — ग्लूकोज़ की गोली, दो-तीन चम्मच चीनी या सादा जूस — और पंद्रह मिनट बाद दोबारा जाँच। इंसुलिन या सल्फोनिलयूरिया लेने वालों के लिए यह ज़्यादा मायने रखता है। अगर बार-बार हो तो डॉक्टर को बताइए, क्योंकि इसका मतलब अक्सर खुराक पर दोबारा सोचना होता है, यह नहीं कि आपसे कोई गलती हुई।`},

 {id:"feet",w:{"foot":4,"feet":4,"पैर":4,"पाँव":4,"numb":3,"सुन्न":4,"tingl":3,"झुनझुनी":4,"nerve":3,"neuropathy":4},conf:.8,
  src:[["ADA Standards of Care 2026","Sec 12","A comprehensive foot examination is recommended at least annually."]],
  en:g=>`Tingling, numbness or burning in the feet is worth mentioning at your next visit rather than waiting. A full foot check is suggested at least once a year, and daily the job is yours: look at the soles, between the toes, and inside your shoes before wearing them. Numbness is the risk — a small cut you cannot feel is how most foot problems start.`,
  hi:g=>`पैरों में झुनझुनी, सुन्नपन या जलन को अगली मुलाक़ात में ज़रूर बताइए, टालिए मत। पूरी जाँच साल में कम से कम एक बार सुझाई जाती है, और रोज़ की जाँच आपका काम है: तलवे देखिए, उँगलियों के बीच देखिए, और जूते पहनने से पहले अंदर हाथ फेरिए। असली जोखिम सुन्नपन है — जो छोटा कट महसूस नहीं होता, वहीं से ज़्यादातर दिक्कतें शुरू होती हैं।`},

 {id:"eye",w:{"eye":4,"vision":4,"आँख":4,"आंख":4,"नजर":3,"नज़र":3,"retina":4,"blurry":3,"धुंधला":3},conf:.8,
  src:[["ADA Standards of Care 2026","Sec 12","A dilated eye examination is recommended at diagnosis and then on a regular schedule."]],
  en:g=>`An eye check with drops that widen the pupil is suggested at diagnosis and then on a schedule your eye doctor sets — often yearly, sometimes every two years if everything has been clear. Early changes at the back of the eye cause no symptoms at all, which is the whole reason the check exists. Blurring that comes and goes with high sugar is common and usually settles as sugar steadies.`,
  hi:g=>`पुतली चौड़ी करने वाली बूँदों के साथ आँखों की जाँच निदान के समय और फिर आपके आँख के डॉक्टर के तय समय पर सुझाई जाती है — अक्सर हर साल, कभी-कभी सब ठीक रहने पर हर दो साल। आँख के पीछे के शुरुआती बदलाव कोई लक्षण नहीं देते, इसी वजह से यह जाँच होती है। शुगर ऊँचा होने पर आती-जाती धुंधलाहट आम है और शुगर संभलने पर आमतौर पर ठीक हो जाती है।`},

 {id:"risk",w:{"risk":4,"score":4,"chance":3,"model":3,"जोखिम":4,"संभावना":4,"स्कोर":4,"प्रतिशत":3,"percent":2},conf:.85,
  en:g=>`The ${g.risk}% on your home page is this model's estimate that your sugar stays above the usual goal. It is built from your age, BMI, sugar average, fasting and after-meal readings, blood pressure and cholesterol, and it moves whenever those move. Read it the way you would read a weather forecast — a pattern across many people, not a statement about what will happen to you. It is useful for comparing your own numbers over time, not for comparing yourself with anyone else.`,
  hi:g=>`होम पेज पर दिखा ${g.risk}% इस मॉडल का अनुमान है कि आपका शुगर सामान्य लक्ष्य से ऊपर रहेगा। यह आपकी उम्र, BMI, औसत शुगर, खाली पेट और खाने के बाद की रीडिंग, ब्लड प्रेशर और कोलेस्ट्रॉल से बना है, और इनके बदलते ही बदल जाता है। इसे मौसम के पूर्वानुमान की तरह पढ़िए — बहुत से लोगों का पैटर्न, आपके साथ क्या होगा इसका बयान नहीं। यह अपने ही नंबरों की समय के साथ तुलना के लिए काम आता है, किसी और से तुलना के लिए नहीं।`},

 {id:"sleep",w:{"sleep":4,"नींद":4,"insomnia":3,"snor":3,"खर्राटे":4,"tired":3,"थकान":3},conf:.72,
  en:g=>`Short or broken sleep raises next-morning sugar in most people, and heavy snoring with daytime tiredness is worth raising with your doctor — sleep apnoea is common alongside type 2 diabetes and treating it often improves both sugar and blood pressure. Seven to nine hours is the usual adult range.`,
  hi:g=>`कम या टूटी नींद ज़्यादातर लोगों में अगली सुबह का शुगर बढ़ा देती है, और तेज़ खर्राटों के साथ दिनभर की थकान डॉक्टर को बतानी चाहिए — टाइप 2 डायबिटीज़ के साथ स्लीप एप्निया आम है और उसका इलाज अक्सर शुगर और ब्लड प्रेशर दोनों सुधारता है। वयस्कों के लिए सात से नौ घंटे सामान्य दायरा है।`},

 {id:"stress",w:{"stress":4,"tension":4,"तनाव":4,"चिंता":4,"anxiety":3,"depress":3,"उदास":3,"mood":2,"mann":2},conf:.72,
  src:[["ADA Standards of Care 2026","Sec 5","Psychosocial care should be integrated into diabetes management."]],
  en:g=>`Stress and low mood are part of diabetes care, not separate from it — they raise sugar directly and they make the daily routine harder to keep. Guidelines ask doctors to check for this at visits, so it is entirely normal to bring up. If it has been weeks rather than days, say so out loud at the next appointment.`,
  hi:g=>`तनाव और उदासी डायबिटीज़ की देखभाल का हिस्सा हैं, उससे अलग चीज़ नहीं — ये सीधे शुगर बढ़ाते हैं और रोज़ की दिनचर्या निभाना मुश्किल कर देते हैं। दिशानिर्देश डॉक्टरों से कहते हैं कि मुलाक़ात में यह पूछें, इसलिए इसे बताना बिल्कुल सामान्य है। अगर यह दिनों नहीं, हफ़्तों से चल रहा है, तो अगली मुलाक़ात में ज़रूर कहिए।`},

 {id:"smoke",w:{"smok":4,"cigarette":4,"tobacco":4,"धूम्रपान":4,"सिगरेट":4,"तंबाकू":4,"alcohol":4,"शराब":4,"drink":2},conf:.76,
  src:[["ADA Standards of Care 2026","Sec 5","Advise all people with diabetes not to use cigarettes or other tobacco products."]],
  en:g=>`Stopping tobacco is the single largest change available in diabetes care — larger than most medicines, because it works on heart, kidney and eye risk at once. On alcohol, the concern with diabetes is that it can drop sugar hours later, especially overnight and especially on insulin or a sulfonylurea. Ask your doctor what fits your medicines.`,
  hi:g=>`तंबाकू छोड़ना डायबिटीज़ की देखभाल का सबसे बड़ा बदलाव है — ज़्यादातर दवाओं से भी बड़ा, क्योंकि यह दिल, गुर्दे और आँख तीनों के जोखिम पर एक साथ काम करता है। शराब के मामले में चिंता यह है कि वह घंटों बाद शुगर गिरा सकती है, ख़ासकर रातभर और ख़ासकर इंसुलिन या सल्फोनिलयूरिया लेने वालों में। अपनी दवाओं के हिसाब से डॉक्टर से पूछिए।`},

 {id:"vaccine",w:{"vaccin":4,"टीका":4,"flu":3,"फ्लू":3,"shot":2},conf:.7,
  src:[["ADA Standards of Care 2026","Sec 4","Routine vaccinations are recommended for people with diabetes as for the general population, with some additions."]],
  en:g=>`Routine vaccines matter a bit more with diabetes because infections unsettle sugar. Which ones and when depends on your age and local schedule, so that is a question for your doctor or clinic rather than for me.`,
  hi:g=>`डायबिटीज़ में सामान्य टीके थोड़े ज़्यादा मायने रखते हैं, क्योंकि संक्रमण शुगर बिगाड़ देते हैं। कौन-से और कब, यह आपकी उम्र और स्थानीय कार्यक्रम पर निर्भर है, इसलिए यह सवाल मुझसे नहीं, आपके डॉक्टर या क्लिनिक से पूछिए।`},

 {id:"test",w:{"how often":4,"kitni baar":4,"कितनी बार":4,"check":2,"जाँच":3,"जांच":3,"test":3,"monitor":3,"glucometer":4,"मशीन":2},conf:.76,
  src:[["ADA Standards of Care 2026","Sec 6","A1C is typically measured at least twice a year when goals are met, and quarterly when therapy changes."]],
  en:g=>`HbA1c is usually done twice a year when things are steady, and about every three months when a medicine has just changed or the goal is not being met. Home finger-prick testing depends on your treatment — it matters most on insulin. Blood pressure at every visit, kidneys and eyes yearly, feet yearly. Your doctor-visit page keeps this as a checklist.`,
  hi:g=>`HbA1c आमतौर पर साल में दो बार होता है जब सब स्थिर हो, और लगभग हर तीन महीने जब दवा अभी बदली हो या लक्ष्य पूरा न हो रहा हो। घर पर उँगली से जाँच आपके इलाज पर निर्भर है — इंसुलिन पर यह सबसे ज़्यादा मायने रखती है। ब्लड प्रेशर हर मुलाक़ात में, गुर्दे और आँखें हर साल, पैर हर साल। डॉक्टर की मुलाक़ात पेज पर यह सूची बनी रहती है।`},

 {id:"cure",w:{"cure":4,"reverse":4,"ठीक हो":4,"इलाज":3,"ख़त्म":3,"remission":4,"permanent":3,"जड़":3},conf:.74,
  en:g=>`Type 2 diabetes is generally described as manageable rather than curable. Remission — sugar staying in range without medicines — does happen, most often after substantial weight loss, and it is checked with an HbA1c off treatment. It is not guaranteed and it is not a failure if it does not happen. Whether it is realistic for you is a question for your doctor, who knows how long you have had it and what your pancreas is doing.`,
  hi:g=>`टाइप 2 डायबिटीज़ को आमतौर पर संभालने लायक कहा जाता है, जड़ से ख़त्म होने वाली नहीं। रेमिशन — दवा के बिना शुगर दायरे में रहना — होता ज़रूर है, अक्सर काफ़ी वज़न घटने के बाद, और इसे दवा बंद करके HbA1c से जाँचा जाता है। यह पक्का नहीं है, और न हो तो यह आपकी नाकामी नहीं। आपके लिए यह कितना मुमकिन है, यह डॉक्टर बताएँगे, जिन्हें पता है कि यह कब से है और आपका अग्न्याशय कैसा काम कर रहा है।`},

 {id:"about",w:{"midtwin":4,"who are you":4,"तुम कौन":4,"app":2,"demo":3,"data":3,"privacy":4,"safe":2,"डेटा":3,"सुरक्षित":3},conf:.9,
  en:g=>`MidTwin is a learning demo. Everything you type — your account, numbers, plans and questions — stays in this browser on this device and is never sent anywhere. The answers are built from your own numbers compared against published diabetes guidance, so they explain and compare; they do not diagnose, and they cannot change your treatment.`,
  hi:g=>`MidTwin सीखने का एक डेमो है। आप जो भी भरते हैं — खाता, नंबर, योजनाएँ और सवाल — सब इसी ब्राउज़र में, इसी डिवाइस पर रहता है और कहीं नहीं भेजा जाता। जवाब आपके अपने नंबरों को प्रकाशित डायबिटीज़ दिशानिर्देशों से मिलाकर बनते हैं, इसलिए ये समझाते और तुलना करते हैं; ये निदान नहीं करते, और आपका इलाज नहीं बदल सकते।`}
];
function tokensOf(s){return s.toLowerCase().replace(/[.,!?;:"'()]/g," ")}
function scoreIntent(q,intent){
  let s=0;
  for(const k in intent.w){if(q.includes(k))s+=intent.w[k]*(1+k.length/40)}
  return s;
}
function whatIf(q){
  const m=q.match(/(\d+(?:\.\d+)?)/g);
  if(!m)return null;
  const has=(...w)=>w.some(x=>q.includes(x));
  const nm=ME.numbers,base=riskOf(nm),copy=Object.assign({},nm);
  const v=parseFloat(m[0]);
  let what=null;
  if(has("hba1c","a1c","sugar","शुगर")&&v>3&&v<20){copy.hba1c=v;what=pick("sugar average of "+v+"%","औसत शुगर "+v+"%")}
  else if(has("weight","kg","वजन","वज़न","किलो")&&v>25&&v<250){copy.weight=v;what=pick("weight of "+v+" kg","वज़न "+v+" किलो")}
  else if(has("bmi")&&v>12&&v<70){copy.height=nm.height;copy.weight=+(v*Math.pow(n(nm.height,165)/100,2)).toFixed(1);what="BMI "+v}
  else if(has("bp","pressure","बीपी","प्रेशर")&&v>80&&v<220){copy.sbp=v;what=pick("top blood pressure of "+v,"ऊपर वाला ब्लड प्रेशर "+v)}
  if(!what)return null;
  const now=riskOf(copy),d=now-base;
  return pick(
    `With a ${what} instead, the model score moves from ${base}% to about ${now}% — ${d===0?"barely a change":(d<0?"about "+Math.abs(d)+" points lower":"about "+d+" points higher")}. That is the model rearranging the same population pattern, not a promise about your body. Nothing else in your numbers was changed for this.`,
    `${what} होने पर मॉडल स्कोर ${base}% से लगभग ${now}% हो जाता है — ${d===0?"लगभग कोई फ़र्क नहीं":(d<0?"करीब "+Math.abs(d)+" अंक कम":"करीब "+d+" अंक ज़्यादा")}। यह मॉडल उसी आबादी के पैटर्न को दोबारा जोड़ रहा है, आपके शरीर के बारे में वादा नहीं। इसके लिए आपके बाकी नंबर वैसे ही रखे गए हैं।`);
}
function answerFor(raw){
  const q=tokensOf(raw),nm=ME.numbers;
  const g={nm,bmi:bmiOf(nm),risk:riskOf(nm),first:ME.name.split(" ")[0]};
  const wi=(q.includes("what if")||q.includes("agar")||q.includes("अगर")||q.includes("हो जाए"))?whatIf(q):null;
  if(wi)return{answer:wi,sources:[],confidence:.8,related:["risk","weight","hba1c"]};
  const ranked=KB.map(k=>({k,s:scoreIntent(q,k)})).sort((a,b)=>b.s-a.s);
  const top=ranked[0];
  if(!top||top.s<2.5){
    return{answer:pick(
      "I did not catch that one. I can explain your sugar average, fasting and after-meal readings, weight and BMI, blood pressure, cholesterol, kidneys, feet, eyes, sleep, stress, how often tests are done, or the model score — and I can play out what-ifs, like “what if my HbA1c were 7?”.",
      "यह सवाल मैं समझ नहीं पाया। मैं आपका औसत शुगर, खाली पेट और खाने के बाद की रीडिंग, वज़न और BMI, ब्लड प्रेशर, कोलेस्ट्रॉल, गुर्दे, पैर, आँखें, नींद, तनाव, जाँच कितनी बार हो, या मॉडल स्कोर समझा सकता हूँ — और “अगर मेरा HbA1c 7 हो जाए तो?” जैसे सवाल भी चला सकता हूँ।"),
      sources:[],confidence:.35,related:["hba1c","food","risk"]};
  }
  const k=top.k;
  return{
    answer:(L==="hi"?k.hi:k.en)(g),
    sources:(k.src||[]).map(s=>({doc:s[0],sec:s[1],text:s[2]})),
    confidence:k.conf||.75,
    related:ranked.slice(1,4).filter(x=>x.s>0).map(x=>x.k.id)
  };
}
const FOLLOW={
 hba1c:["What if my HbA1c were 7?","अगर मेरा HbA1c 7 हो जाए तो?"],
 weight:["What if I weighed 78 kg?","अगर मेरा वज़न 78 किलो हो जाए तो?"],
 risk:["How is the score worked out?","स्कोर कैसे निकलता है?"],
 food:["What should I eat?","मुझे क्या खाना चाहिए?"],
 bp:["How is my blood pressure?","मेरा ब्लड प्रेशर कैसा है?"],
 exercise:["How much should I walk?","कितना चलना चाहिए?"],
 kidney:["Are my kidneys fine?","मेरे गुर्दे ठीक हैं?"],
 chol:["Explain my cholesterol","मेरा कोलेस्ट्रॉल समझाइए"],
 low:["What if my sugar drops?","शुगर गिर जाए तो?"],
 feet:["My feet tingle at night","रात को पैरों में झुनझुनी होती है"],
 eye:["When should I check my eyes?","आँखें कब जँचवाऊँ?"],
 test:["How often are tests done?","जाँच कितनी बार होती है?"],
 fasting:["Why is morning sugar high?","सुबह शुगर ऊँचा क्यों?"],
 post:["Why does sugar rise after food?","खाने के बाद शुगर क्यों चढ़ता है?"],
 medicine:["Prepare me for my doctor visit","डॉक्टर की मुलाक़ात की तैयारी कराइए"],
 sleep:["Does sleep affect sugar?","क्या नींद शुगर पर असर करती है?"],
 stress:["Stress and sugar","तनाव और शुगर"],
 smoke:["Alcohol and diabetes","शराब और डायबिटीज़"],
 cure:["Can this be reversed?","क्या यह ठीक हो सकता है?"],
 about:["Where is my data kept?","मेरा डेटा कहाँ रहता है?"],
 greet:["What stands out in my numbers?","मेरे नंबरों में क्या खास है?"],
 vaccine:["Which vaccines matter?","कौन-से टीके मायने रखते हैं?"]
};

/* ======================= ask ======================= */
let speakOn=false,rec=null,listening=false;
function viewAsk(host){
  const steps=pick(["Reading your question","Your numbers","Guidelines","Writing the answer"],
                   ["सवाल समझ रहा हूँ","आपके नंबर","दिशानिर्देश","जवाब लिख रहा हूँ"]);
  const starters=pick(["What if my HbA1c were 7?","Why is my morning sugar high?","How is my blood pressure?","What should I eat?","How much should I walk?"],
                      ["अगर मेरा HbA1c 7 हो जाए तो?","सुबह शुगर ऊँचा क्यों रहता है?","मेरा ब्लड प्रेशर कैसा है?","मुझे क्या खाना चाहिए?","कितना चलना चाहिए?"]);
  host.innerHTML=`
  <div class="row between"><h1>${pick("Ask MidTwin","MidTwin से पूछिए")}</h1>
    <button class="chip ${speakOn?"on":""}" id="spk">🔈 ${pick("Read aloud","बोलकर सुनाएँ")}: ${speakOn?pick("on","चालू"):pick("off","बंद")}</button></div>
  <p class="mute" style="margin-top:8px">${pick(
    "Type, or tap the mic and speak — English or हिन्दी. Every answer is built from your own numbers, and you can ask what-ifs like “what if my HbA1c were 7?”.",
    "लिखिए, या माइक दबाकर बोलिए — अंग्रेज़ी या हिन्दी। हर जवाब आपके अपने नंबरों से बनता है, और आप “अगर मेरा HbA1c 7 हो जाए तो?” जैसे सवाल भी पूछ सकते हैं।")}</p>
  <div class="pipe" id="pipe">${steps.map(s=>`<span>${esc(s)}</span>`).join("")}</div>
  <div class="card">
    <div id="msgs"></div>
    <div class="row" id="sugg" style="margin:14px 0">${starters.map(s=>`<button class="chip">${esc(s)}</button>`).join("")}</div>
    <form class="row" id="qf">
      <input id="q" style="flex:1;min-width:180px" placeholder="${pick("Type your question here…","यहाँ अपना सवाल लिखें…")}" aria-label="Your question">
      <button type="button" class="chip" id="mic">🎙 ${pick("Speak","बोलिए")}</button>
      <button class="btn" type="submit">${pick("Send","भेजें")}</button>
    </form>
  </div>
  <p class="small mute" style="margin-top:12px">${pick(
    "MidTwin explains numbers and published guidance. It does not diagnose, and it cannot change your medicines.",
    "MidTwin नंबर और प्रकाशित दिशानिर्देश समझाता है। यह निदान नहीं करता, और आपकी दवाएँ नहीं बदल सकता।")}</p>`;

  const msgs=$("#msgs");
  (ME.history||[]).slice(-6).forEach(h=>{add("u",esc(h.q));add("a",h.a)});
  if(!(ME.history||[]).length)add("a",pick(`Hi ${esc(ME.name.split(" ")[0])}. Type a question, or tap 🎙 and speak.`,
    `नमस्ते ${esc(ME.name.split(" ")[0])}! सवाल लिखिए, या 🎙 दबाकर बोलिए।`));

  $("#spk").onclick=()=>{speakOn=!speakOn;if(!speakOn&&window.speechSynthesis)speechSynthesis.cancel();viewAsk(host);bindFx()};
  $("#sugg").querySelectorAll(".chip").forEach(c=>c.onclick=()=>ask(c.textContent));
  $("#qf").onsubmit=e=>{e.preventDefault();const v=$("#q").value.trim();if(v){$("#q").value="";ask(v)}};
  $("#mic").onclick=micToggle;
  const pend=sessionStorage.getItem("mt_pending");
  if(pend){sessionStorage.removeItem("mt_pending");setTimeout(()=>ask(pend),120)}

  function add(cls,html){msgs.insertAdjacentHTML("beforeend",`<div class="m ${cls}">${html}</div>`);msgs.scrollTop=msgs.scrollHeight}
  function ask(text){
    add("u",esc(text));
    const pipe=[...$("#pipe").children];let i=0;
    const tm=setInterval(()=>{pipe.forEach((e,k)=>e.className=k<i?"done":k===i?"on":"");i++},320);
    const t=el('<div class="m a typing"><i></i><i></i><i></i></div>');msgs.appendChild(t);msgs.scrollTop=msgs.scrollHeight;
    setTimeout(()=>{
      clearInterval(tm);pipe.forEach(e=>e.className="done");t.remove();
      const r=answerFor(text);
      const src=(r.sources||[]).map(x=>`<p style="margin-top:6px"><b>${esc(x.doc)}</b> (${esc(x.sec)}): ${esc(x.text)}</p>`).join("");
      const rel=(r.related||[]).map(id=>FOLLOW[id]).filter(Boolean).slice(0,2)
        .map(f=>`<button class="chip rel" style="margin:8px 6px 0 0">${esc(pick(f[0],f[1]))}</button>`).join("");
      const html=`${esc(r.answer)}
        ${src?`<details><summary>${pick("Sources","स्रोत")} (${r.sources.length})</summary>${src}</details>`:""}
        <div class="bar"><i style="width:${Math.round(r.confidence*100)}%"></i></div>
        <small class="mute">${pick("Backed by sources","स्रोतों से पुष्टि")}: ${Math.round(r.confidence*100)}% · ${pick("This is not medical advice.","यह चिकित्सा सलाह नहीं है।")}</small>
        ${rel?`<div class="row noprint">${rel}</div>`:""}`;
      add("a",html);
      msgs.querySelectorAll(".rel").forEach(b=>b.onclick=()=>ask(b.textContent));
      ME.history=(ME.history||[]).concat({q:text,a:html,plain:r.answer,t:Date.now(),lang:L});
      if(ME.history.length>200)ME.history=ME.history.slice(-200);
      saveMe();
      if(speakOn)speak(r.answer);
      bindFx();
    },1400);
  }
  function speak(text){
    try{if(!window.speechSynthesis)return;speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);u.lang=L==="hi"?"hi-IN":"en-IN";speechSynthesis.speak(u)}catch(e){}
  }
  function micToggle(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){add("a",pick("Speaking needs Chrome or Edge. Typing works everywhere.","बोलकर पूछने के लिए Chrome या Edge चाहिए। लिखना हर जगह चलता है।"));return}
    if(listening){try{rec.stop()}catch(e){}return}
    rec=new SR();rec.lang=L==="hi"?"hi-IN":"en-IN";rec.interimResults=true;let fin="";
    rec.onresult=e=>{let x="";for(const r of e.results){x+=r[0].transcript;if(r.isFinal)fin=x}$("#q").value=x};
    rec.onerror=e=>{setMic(false);add("a",e.error==="not-allowed"
      ?pick("The mic is blocked. Allow microphone access in the address bar.","माइक की अनुमति नहीं मिली। एड्रेस बार से अनुमति दीजिए।"):"Mic stopped: "+e.error)};
    rec.onend=()=>{setMic(false);const x=(fin||$("#q").value).trim();if(x){$("#q").value="";ask(x)}};
    try{rec.start();setMic(true)}catch(e){setMic(false)}
  }
  function setMic(on){
    listening=on;const m=$("#mic");if(!m)return;
    m.classList.toggle("rec",on);
    m.textContent=on?pick("⏹ Listening","⏹ सुन रहा हूँ"):pick("🎙 Speak","🎙 बोलिए");
  }
}

/* ======================= history ======================= */
function viewHistory(host){
  const h=(ME.history||[]).slice().reverse();
  host.innerHTML=`
  <h1>${pick("Everything you have asked","आपके सारे सवाल")}</h1>
  <p class="mute" style="margin-top:8px">${h.length?pick(h.length+" question"+(h.length>1?"s":"")+", kept on this device only.",h.length+" सवाल, सिर्फ़ इसी डिवाइस पर सहेजे हुए।"):pick("Nothing here yet.","अभी यहाँ कुछ नहीं।")}</p>
  <div class="row" style="margin:18px 0">
    <input id="hq" placeholder="${pick("Search your questions","अपने सवाल खोजिए")}" style="flex:1;min-width:200px">
    ${h.length?`<button class="chip" id="clr">${pick("Clear history","इतिहास मिटाएँ")}</button>`:""}
    <a class="chip" href="#/ask">${pick("Ask something new","नया सवाल पूछें")}</a>
  </div>
  <div id="hlist" class="stack"></div>`;
  const list=$("#hlist");
  const draw=(term="")=>{
    const f=h.filter(x=>x.q.toLowerCase().includes(term.toLowerCase()));
    list.innerHTML=f.length?f.map(x=>`<div class="card">
      <div class="row between"><b>${esc(x.q)}</b><span class="mute small">${fmtDate(x.t)}</span></div>
      <hr class="sep"><p>${esc(x.plain||"")}</p>
      <div class="row" style="margin-top:12px"><button class="chip again" data-q="${esc(x.q)}">${pick("Ask this again","यही दोबारा पूछें")}</button></div>
    </div>`).join(""):`<div class="card"><p class="mute">${h.length?pick("No question matches that search.","इस खोज से कोई सवाल नहीं मिला।"):pick("Ask your first question and it will show up here, answer included.","पहला सवाल पूछिए, वह जवाब सहित यहाँ दिखेगा।")}</p></div>`;
    list.querySelectorAll(".again").forEach(b=>b.onclick=()=>{sessionStorage.setItem("mt_pending",b.dataset.q);go("ask")});
    bindFx();
  };
  draw();
  $("#hq").oninput=e=>draw(e.target.value);
  const c=$("#clr");
  if(c)c.onclick=()=>{if(confirm(pick("Delete every saved question and answer?","सारे सहेजे सवाल-जवाब मिटा दें?"))){ME.history=[];saveMe();render()}};
}

/* ======================= diet ======================= */
const MEALS=[
 {s:"b",n:["Vegetable daliya with curd","सब्ज़ी वाला दलिया और दही"],k:320,t:["veg"],al:["milk"]},
 {s:"b",n:["Besan chilla with mint chutney","बेसन का चीला और पुदीने की चटनी"],k:300,t:["veg","vegan"],al:[]},
 {s:"b",n:["Moong dal idli with sambar","मूंग दाल इडली और सांभर"],k:340,t:["veg","vegan"],al:[]},
 {s:"b",n:["Two boiled eggs with a multigrain roti","दो उबले अंडे और मल्टीग्रेन रोटी"],k:330,t:["egg","nonveg"],al:["egg","gluten"]},
 {s:"b",n:["Oats porridge with cinnamon and walnuts","दालचीनी और अखरोट वाला ओट्स"],k:350,t:["veg","vegan"],al:["nuts"]},
 {s:"b",n:["Poha with peanuts and plenty of onion","मूंगफली और ढेर सारे प्याज़ वाला पोहा"],k:310,t:["veg","vegan"],al:["nuts"]},
 {s:"b",n:["Masala omelette with sautéed spinach","मसाला ऑमलेट और भुनी पालक"],k:300,t:["egg","nonveg"],al:["egg"]},
 {s:"b",n:["Ragi dosa with coconut chutney","रागी डोसा और नारियल चटनी"],k:330,t:["veg","vegan"],al:[]},
 {s:"l",n:["Two rotis, rajma, cucumber salad","दो रोटी, राजमा, खीरे का सलाद"],k:520,t:["veg","vegan"],al:["gluten"]},
 {s:"l",n:["Brown rice, dal tadka, bhindi sabzi","ब्राउन राइस, दाल तड़का, भिंडी"],k:540,t:["veg","vegan"],al:[]},
 {s:"l",n:["Roti, palak paneer, salad","रोटी, पालक पनीर, सलाद"],k:560,t:["veg"],al:["milk","gluten"]},
 {s:"l",n:["Grilled chicken, two rotis, lauki sabzi","ग्रिल्ड चिकन, दो रोटी, लौकी की सब्ज़ी"],k:570,t:["nonveg"],al:["gluten"]},
 {s:"l",n:["Fish curry with a small bowl of rice","मछली करी और थोड़ा चावल"],k:540,t:["nonveg"],al:["fish"]},
 {s:"l",n:["Chana masala with jowar roti","छोले और ज्वार की रोटी"],k:530,t:["veg","vegan"],al:[]},
 {s:"l",n:["Curd rice with cucumber and one roti","दही चावल, खीरा और एक रोटी"],k:500,t:["veg"],al:["milk","gluten"]},
 {s:"l",n:["Sambar, rice, beans poriyal","सांभर, चावल, बीन्स पोरियल"],k:520,t:["veg","vegan"],al:[]},
 {s:"s",n:["A bowl of sprouts with lemon","नींबू वाले अंकुरित अनाज"],k:150,t:["veg","vegan"],al:[]},
 {s:"s",n:["Roasted chana, a handful","मुट्ठीभर भुने चने"],k:140,t:["veg","vegan"],al:[]},
 {s:"s",n:["Guava or a small apple","अमरूद या छोटा सेब"],k:90,t:["veg","vegan"],al:[]},
 {s:"s",n:["Buttermilk with roasted cumin","भुने जीरे वाली छाछ"],k:80,t:["veg"],al:["milk"]},
 {s:"s",n:["Five almonds and two walnuts","पाँच बादाम और दो अखरोट"],k:160,t:["veg","vegan"],al:["nuts"]},
 {s:"s",n:["Cucumber and carrot sticks with hung curd dip","खीरा-गाजर और गाढ़े दही का डिप"],k:120,t:["veg"],al:["milk"]},
 {s:"d",n:["Moong dal khichdi with a bowl of curd","मूंग दाल खिचड़ी और एक कटोरी दही"],k:440,t:["veg"],al:["milk"]},
 {s:"d",n:["Two rotis, mixed vegetable sabzi, dal","दो रोटी, मिली-जुली सब्ज़ी, दाल"],k:470,t:["veg","vegan"],al:["gluten"]},
 {s:"d",n:["Paneer bhurji with one roti","पनीर भुर्जी और एक रोटी"],k:460,t:["veg"],al:["milk","gluten"]},
 {s:"d",n:["Chicken stew with vegetables","सब्ज़ियों वाला चिकन स्टू"],k:450,t:["nonveg"],al:[]},
 {s:"d",n:["Grilled fish with sautéed beans","ग्रिल्ड मछली और भुनी बीन्स"],k:430,t:["nonveg"],al:["fish"]},
 {s:"d",n:["Vegetable soup with one jowar roti","सब्ज़ी का सूप और एक ज्वार की रोटी"],k:400,t:["veg","vegan"],al:[]},
 {s:"d",n:["Dal, lauki sabzi, small bowl of rice","दाल, लौकी की सब्ज़ी, थोड़ा चावल"],k:450,t:["veg","vegan"],al:[]}
];
const ALLERGENS=[["milk",["Milk & paneer","दूध और पनीर"]],["gluten",["Wheat / gluten","गेहूँ / ग्लूटेन"]],
 ["nuts",["Nuts","मेवे"]],["egg",["Egg","अंडा"]],["fish",["Fish","मछली"]]];
function calorieTarget(p){
  const nm=ME.numbers,w=n(nm.weight,70),h=n(nm.height,165),a=n(nm.age,50);
  const bmr=10*w+6.25*h-5*a+(p.sex==="male"?5:-161);
  const act={low:1.2,some:1.375,active:1.55}[p.activity]||1.2;
  let k=bmr*act;
  if(p.goal==="lose")k-=500;
  return Math.max(p.sex==="male"?1500:1200,Math.round(k/10)*10);
}
function buildPlan(p){
  const ok=m=>{
    if(p.type==="veg"&&!(m.t.includes("veg")||m.t.includes("vegan")))return false;
    if(p.type==="vegan"&&!m.t.includes("vegan"))return false;
    if(p.type==="egg"&&!(m.t.includes("veg")||m.t.includes("vegan")||m.t.includes("egg")))return false;
    return !m.al.some(a=>p.avoid.includes(a));
  };
  const pool=s=>{const x=MEALS.filter(m=>m.s===s&&ok(m));return x.length?x:MEALS.filter(m=>m.s===s)};
  const kcal=calorieTarget(p);
  const split=p.meals==="3"?{b:.30,l:.40,d:.30}:{b:.25,l:.35,s:.12,d:.28};
  const slots=p.meals==="3"?["b","l","d"]:["b","l","s","d"];
  const days=[["Monday","सोमवार"],["Tuesday","मंगलवार"],["Wednesday","बुधवार"],["Thursday","गुरुवार"],["Friday","शुक्रवार"],["Saturday","शनिवार"],["Sunday","रविवार"]];
  const when={b:["Breakfast","नाश्ता"],l:["Lunch","दोपहर"],s:["Evening","शाम"],d:["Dinner","रात"]};
  return {kcal,prefs:p,made:Date.now(),
    plan:days.map((d,i)=>({day:d,meals:slots.map(s=>{
      const P=pool(s),m=P[(i*3+s.charCodeAt(0))%P.length],target=Math.round(kcal*split[s]),por=target/m.k;
      return {when:when[s],name:m.n,kcal:target,
        portion:por>1.2?["a generous plate","भरी हुई थाली"]:por<.8?["a small plate","छोटी थाली"]:["a normal plate","सामान्य थाली"]};
    })}))};
}
function viewDiet(host){(!ME.dietPrefs||!ME.diet)?dietForm(host):dietPlanView(host)}
function dietForm(host){
  const p=ME.dietPrefs||{type:"veg",sex:ME.profile.sex||"female",activity:"low",goal:"lose",meals:"4",avoid:[],notes:""};
  host.innerHTML=`
  <h1>${pick("What should I eat?","मुझे क्या खाना चाहिए?")}</h1>
  <p class="mute" style="margin-top:8px">${pick(
    "Answer six things once. MidTwin builds a full week of meals with portions worked out from your height, weight, age and activity — and you can change it any time.",
    "छह बातें एक बार बताइए। MidTwin पूरे हफ़्ते का खाना बना देगा, हिस्से आपकी लंबाई, वज़न, उम्र और गतिविधि से निकालकर — और आप इसे कभी भी बदल सकते हैं।")}</p>
  <form class="card" id="dietForm" style="margin-top:20px">
    <div class="grid g-auto">
      <div class="field"><label for="type">${pick("What do you eat?","आप क्या खाते हैं?")}</label>
        <select id="type" name="type">
          <option value="veg"${p.type==="veg"?" selected":""}>${pick("Vegetarian","शाकाहारी")}</option>
          <option value="vegan"${p.type==="vegan"?" selected":""}>${pick("Vegetarian, no milk","शाकाहारी, दूध नहीं")}</option>
          <option value="egg"${p.type==="egg"?" selected":""}>${pick("Vegetarian plus egg","शाकाहारी + अंडा")}</option>
          <option value="nonveg"${p.type==="nonveg"?" selected":""}>${pick("Everything","सब कुछ")}</option></select></div>
      <div class="field"><label for="sex">${pick("Used for the calorie maths","कैलोरी गणित के लिए")}</label>
        <select id="sex" name="sex"><option value="female"${p.sex==="female"?" selected":""}>${pick("Female","महिला")}</option>
        <option value="male"${p.sex==="male"?" selected":""}>${pick("Male","पुरुष")}</option></select></div>
      <div class="field"><label for="activity">${pick("How much do you move in a day?","दिनभर कितना चलते हैं?")}</label>
        <select id="activity" name="activity">
          <option value="low"${p.activity==="low"?" selected":""}>${pick("Mostly sitting","ज़्यादातर बैठे")}</option>
          <option value="some"${p.activity==="some"?" selected":""}>${pick("A walk most days","लगभग रोज़ सैर")}</option>
          <option value="active"${p.activity==="active"?" selected":""}>${pick("On my feet or exercising daily","रोज़ पैरों पर या कसरत")}</option></select></div>
      <div class="field"><label for="goal">${pick("What are you aiming for?","आप क्या चाहते हैं?")}</label>
        <select id="goal" name="goal"><option value="lose"${p.goal==="lose"?" selected":""}>${pick("Bring my weight down slowly","धीरे-धीरे वज़न घटाना")}</option>
        <option value="hold"${p.goal==="hold"?" selected":""}>${pick("Stay where I am","जहाँ हूँ वहीं रहना")}</option></select></div>
      <div class="field"><label for="meals">${pick("How many times do you eat?","दिन में कितनी बार खाते हैं?")}</label>
        <select id="meals" name="meals"><option value="3"${p.meals==="3"?" selected":""}>${pick("Three meals","तीन बार")}</option>
        <option value="4"${p.meals==="4"?" selected":""}>${pick("Three meals and an evening snack","तीन बार और शाम का नाश्ता")}</option></select></div>
      <div class="field"><label>${pick("Anything you cannot eat?","कुछ ऐसा जो आप नहीं खा सकते?")}</label>
        <div class="row" id="avoid" style="margin-top:8px">${ALLERGENS.map(([k,l])=>`<button type="button" class="chip ${p.avoid.includes(k)?"on":""}" data-k="${k}">${esc(pick(l[0],l[1]))}</button>`).join("")}</div>
        <span class="hint">${pick("Tap the ones to keep out of your plan.","जिन्हें योजना से बाहर रखना है, उन पर दबाइए।")}</span></div>
    </div>
    <div class="field"><label for="notes">${pick("Anything else I should know?","और कुछ जो मुझे पता होना चाहिए?")}</label>
      <textarea id="notes" name="notes" placeholder="${pick("E.g. I skip breakfast on workdays, or I eat dinner very late.","जैसे काम के दिनों में नाश्ता छोड़ देता हूँ, या रात का खाना बहुत देर से।")}">${esc(p.notes||"")}</textarea></div>
    <button class="btn" type="submit">${pick("Build my week","मेरा हफ़्ता बनाइए")}</button>
  </form>
  <div class="note" style="margin-top:18px">${pick(
    "This plan is a starting point built from general guidance. A dietitian or your doctor can fit it to your medicines — especially if you take insulin.",
    "यह योजना सामान्य दिशानिर्देशों से बनी एक शुरुआत है। डायटीशियन या आपके डॉक्टर इसे आपकी दवाओं के हिसाब से ढाल सकते हैं — ख़ासकर अगर इंसुलिन लेते हों।")}</div>`;
  const chosen=new Set(p.avoid);
  $("#avoid").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{
    const k=b.dataset.k;chosen.has(k)?chosen.delete(k):chosen.add(k);b.classList.toggle("on")});
  $("#dietForm").onsubmit=e=>{
    e.preventDefault();
    const v=Object.fromEntries(new FormData(e.target));v.avoid=[...chosen];
    ME.dietPrefs=v;ME.diet=buildPlan(v);ME.profile.sex=v.sex;saveMe();render();
  };
}
let dietDay=0;
function dietPlanView(host){
  const d=ME.diet,p=ME.dietPrefs,nm=ME.numbers,day=d.plan[Math.min(dietDay,6)];
  const carbs=Math.round(d.kcal*.45/4),prot=Math.round(d.kcal*.22/4),fat=Math.round(d.kcal*.33/9);
  const typeTxt={veg:["a vegetarian","शाकाहारी"],vegan:["a vegetarian who avoids milk","दूध से परहेज़ करने वाले शाकाहारी"],
    egg:["a vegetarian who eats egg","अंडा खाने वाले शाकाहारी"],nonveg:["someone who eats everything","सब कुछ खाने वाले"]}[p.type];
  host.innerHTML=`
  <div class="row between"><h1>${pick("Your week of food","आपके हफ़्ते का खाना")}</h1>
    <div class="row noprint"><button class="chip" id="redo">${pick("Change my answers","जवाब बदलें")}</button>
    <button class="chip" id="print">${pick("Print","छापें")}</button></div></div>
  <p class="mute" style="margin-top:8px">${pick("Built for ","बनाया गया: ")}${esc(pick(typeTxt[0],typeTxt[1]))}, ${esc(pick({low:"mostly sitting",some:"walking most days",active:"active daily"}[p.activity],{low:"ज़्यादातर बैठे",some:"लगभग रोज़ सैर",active:"रोज़ सक्रिय"}[p.activity]))}, ${p.goal==="lose"?pick("aiming to bring weight down slowly","धीरे-धीरे वज़न घटाने के लिए"):pick("aiming to stay steady","जैसा है वैसा रखने के लिए")}.
    ${p.avoid.length?pick("Keeping out: ","बाहर रखा: ")+p.avoid.map(a=>{const f=ALLERGENS.find(x=>x[0]===a);return f?pick(f[1][0],f[1][1]):a}).join(", ")+".":""}</p>

  <div class="grid g-auto" style="margin:20px 0">
    <div class="card"><span class="mute small">${pick("A day for you","आपके एक दिन के लिए")}</span>
      <div class="num" style="margin-top:8px">${d.kcal}<span class="mute" style="font-size:.88rem"> kcal</span></div>
      <p class="mute small" style="margin-top:6px">${pick("From your height","आपकी लंबाई")} ${esc(nm.height)} cm, ${pick("weight","वज़न")} ${esc(nm.weight)} kg, ${pick("age","उम्र")} ${esc(nm.age)}.</p></div>
    <div class="card"><span class="mute small">${pick("Roughly split as","मोटे तौर पर बँटवारा")}</span>
      <div style="margin-top:10px"><span class="pill">${pick("Carbs","कार्ब्स")} ${carbs} g</span><span class="pill">${pick("Protein","प्रोटीन")} ${prot} g</span><span class="pill">${pick("Fat","वसा")} ${fat} g</span></div>
      <p class="mute small">${pick("Spread the carbs across meals instead of one big serving.","कार्ब्स को सारे खानों में बाँटिए, एक बार में नहीं।")}</p></div>
    <div class="card"><span class="mute small">${pick("The plate rule","थाली का नियम")}</span>
      <p style="margin-top:8px">${pick("Half vegetables, one quarter dal, paneer, egg or meat, one quarter roti or rice. It works even when you eat out.","आधी सब्ज़ी, चौथाई दाल-पनीर-अंडा-मांस, चौथाई रोटी या चावल। बाहर खाते समय भी यही चलता है।")}</p></div>
  </div>

  <div class="card">
    <div class="daytabs noprint">${d.plan.map((x,i)=>`<button class="chip ${i===Math.min(dietDay,6)?"on":""}" data-i="${i}">${esc(pick(x.day[0].slice(0,3),x.day[1].slice(0,3)))}</button>`).join("")}</div>
    <h2>${esc(pick(day.day[0],day.day[1]))}</h2><hr class="sep">
    ${day.meals.map(m=>`<div class="meal"><span class="when">${esc(pick(m.when[0],m.when[1]))}</span>
      <div><b>${esc(pick(m.name[0],m.name[1]))}</b><br><span class="mute small">${esc(pick(m.name[1],m.name[0]))} · ${esc(pick(m.portion[0],m.portion[1]))}</span></div>
      <span class="kcal">${m.kcal} kcal</span></div>`).join("")}
    <p class="mute small" style="margin-top:14px">${pick("Water: 8–10 glasses across the day, unless your doctor has asked you to limit fluids.","पानी: दिनभर में 8–10 गिलास, जब तक डॉक्टर ने कम करने को न कहा हो।")}</p>
  </div>

  <div class="grid g-2" style="margin-top:18px">
    <div class="card"><h3>${pick("Worth keeping small","कम रखने लायक")}</h3><hr class="sep">
      <p class="mute">${pick("Sugary drinks and packed juice, sweets, fried snacks, white bread and maida, and second helpings of rice. None of these are banned — they just crowd out room on the plate.","मीठे पेय और डिब्बाबंद जूस, मिठाई, तली चीज़ें, सफ़ेद ब्रेड और मैदा, और चावल की दूसरी प्लेट। इनमें से कुछ मना नहीं है — बस थाली की जगह घेर लेते हैं।")}</p></div>
    <div class="card"><h3>${pick("Easy swaps for Indian kitchens","भारतीय रसोई के आसान बदलाव")}</h3><hr class="sep">
      <p class="mute">${pick("Jowar or bajra roti in place of some wheat. Curd instead of a sweet after dinner. Roasted chana instead of biscuits with tea. Vegetables cooked into the dal rather than served as a side you skip.","कुछ गेहूँ की जगह ज्वार या बाजरे की रोटी। रात के खाने के बाद मिठाई की जगह दही। चाय के साथ बिस्किट की जगह भुने चने। सब्ज़ी दाल में ही पकाइए, अलग रखी सब्ज़ी अक्सर छूट जाती है।")}</p></div>
  </div>

  <div class="card" style="margin-top:18px"><h3>${pick("To take to your doctor","डॉक्टर के लिए")}</h3><hr class="sep">
    <p class="mute">${pick("Sugar average","औसत शुगर")} ${esc(nm.hba1c)}%, ${pick("fasting","खाली पेट")} ${esc(nm.fasting)} mg/dL, ${pick("blood pressure","ब्लड प्रेशर")} ${esc(nm.sbp)}/${esc(nm.dbp)}, BMI ${bmiOf(nm)}, ${pick("daily target","रोज़ का लक्ष्य")} ${d.kcal} kcal.${p.notes?" "+esc(p.notes):""}</p></div>
  <p class="small mute" style="margin-top:14px">${pick("Made on","बनाया गया")} ${fmtDate(d.made)}.</p>`;
  host.querySelectorAll(".daytabs .chip").forEach(b=>b.onclick=()=>{dietDay=+b.dataset.i;dietPlanView(host);bindFx()});
  $("#redo").onclick=()=>{ME.diet=null;saveMe();render()};
  $("#print").onclick=()=>window.print();
}

/* ======================= movement ======================= */
function viewMove(host){
  const nm=ME.numbers,p=ME.dietPrefs||{activity:"low"};
  const base={low:15,some:25,active:35}[p.activity]||15;
  const week=[
   [["Monday","सोमवार"],[["Brisk walk","तेज़ सैर"],base+" min"],[["Walk after your largest meal","सबसे बड़े खाने के बाद सैर"],"10 min"]],
   [["Tuesday","मंगलवार"],[["Simple strength: sit-to-stand, wall push-ups","आसान ताक़त: कुर्सी से उठना-बैठना, दीवार पुश-अप"],"2 × 10"],[["Easy walk","आराम की सैर"],"15 min"]],
   [["Wednesday","बुधवार"],[["Brisk walk","तेज़ सैर"],(base+5)+" min"],[["Walk after your largest meal","सबसे बड़े खाने के बाद सैर"],"10 min"]],
   [["Thursday","गुरुवार"],[["Stretching or gentle yoga","स्ट्रेचिंग या हल्का योग"],"15 min"],[["Easy walk","आराम की सैर"],"15 min"]],
   [["Friday","शुक्रवार"],[["Brisk walk","तेज़ सैर"],(base+5)+" min"],[["Simple strength","आसान ताक़त वाली कसरत"],"2 × 10"]],
   [["Saturday","शनिवार"],[["Longer walk, or cycling","लंबी सैर, या साइकिल"],(base+15)+" min"],[["Stretching","स्ट्रेचिंग"],"10 min"]],
   [["Sunday","रविवार"],[["Rest, or a slow stroll","आराम, या धीमी सैर"],"20 min"],[["Plan the week ahead","अगले हफ़्ते की तैयारी"],"—"]]
  ];
  const mins=base*3+(base+15)+90;
  host.innerHTML=`
  <div class="row between"><h1>${pick("Moving through the week","हफ़्ते भर चलना-फिरना")}</h1>
    <button class="chip noprint" id="printM">${pick("Print","छापें")}</button></div>
  <p class="mute" style="margin-top:8px">${pick(
    "Guidelines suggest around 150 minutes of moderate activity a week plus two days of simple strength work. This week adds up to roughly "+mins+" minutes, built from what you told the food plan.",
    "दिशानिर्देश हफ़्ते में लगभग 150 मिनट की मध्यम गतिविधि और दो दिन आसान ताक़त वाली कसरत सुझाते हैं। यह हफ़्ता लगभग "+mins+" मिनट बनता है, जो आपने खाने की योजना में बताया उसी से।")}</p>

  <div class="grid g-auto" style="margin:20px 0">
    <div class="card"><span class="mute small">${pick("The one habit worth most","सबसे क़ीमती एक आदत")}</span>
      <p style="margin-top:8px">${pick("A ten-minute walk after your largest meal. It flattens the rise in sugar more reliably than the same ten minutes at any other hour.","सबसे बड़े खाने के बाद दस मिनट की सैर। यह शुगर के उछाल को दिन के किसी और समय की उतनी ही सैर से ज़्यादा भरोसे के साथ कम करती है।")}</p></div>
    <div class="card"><span class="mute small">${pick("Before you start","शुरू करने से पहले")}</span>
      <p style="margin-top:8px">${pick("With your blood pressure at "+nm.sbp+", check with your doctor before anything vigorous. Carry something sweet if you are on insulin or a sulfonylurea.","आपके "+nm.sbp+" ब्लड प्रेशर के साथ, तेज़ कसरत से पहले डॉक्टर से पूछ लीजिए। इंसुलिन या सल्फोनिलयूरिया लेते हों तो कुछ मीठा साथ रखिए।")}</p></div>
    <div class="card"><span class="mute small">${pick("Footwear","जूते")}</span>
      <p style="margin-top:8px">${pick("Closed shoes that fit, and a look at your feet afterwards. Numb feet do not report blisters.","ठीक बैठने वाले बंद जूते, और बाद में पैरों पर एक नज़र। सुन्न पैर छाले की ख़बर नहीं देते।")}</p></div>
  </div>

  <div class="card"><h2>${pick("Your week","आपका हफ़्ता")}</h2><hr class="sep">
    ${week.map(([d,a,b])=>`<div class="meal"><span class="when">${esc(pick(d[0],d[1]))}</span>
      <div><b>${esc(pick(a[0][0],a[0][1]))}</b><br><span class="mute small">${esc(pick(b[0][0],b[0][1]))}</span></div>
      <span class="kcal">${esc(a[1])} · ${esc(b[1])}</span></div>`).join("")}
  </div>

  <div class="card" style="margin-top:18px"><h3>${pick("Stop and rest if","रुक जाइए अगर")}</h3><hr class="sep">
    <p class="mute">${pick("Chest pain or tightness, unusual breathlessness, dizziness, or pain in a foot. None of these are 'push through it' signals — they are reasons to stop and, for chest symptoms, to seek help straight away.","सीने में दर्द या भारीपन, असामान्य साँस फूलना, चक्कर, या पैर में दर्द। इनमें से कोई भी 'सह लो' वाला संकेत नहीं है — ये रुकने की वजह हैं, और सीने की तकलीफ़ में तुरंत मदद लेने की।")}</p></div>`;
  $("#printM").onclick=()=>window.print();
}

/* ======================= learn ======================= */
const LEARN=[
 [["What is HbA1c really measuring?","HbA1c असल में क्या नापता है?"],
  ["Sugar sticks to the haemoglobin inside your red blood cells, and those cells live about three months. HbA1c counts how much sugar is stuck, so it tells you the average of the last eight to twelve weeks. That is why it barely moves in a week, and why one bad day does not show up in it.",
   "शुगर आपकी लाल रक्त कोशिकाओं के अंदर हीमोग्लोबिन से चिपक जाती है, और वे कोशिकाएँ लगभग तीन महीने जीती हैं। HbA1c गिनता है कि कितनी शुगर चिपकी है, यानी पिछले आठ से बारह हफ़्तों का औसत। इसीलिए यह एक हफ़्ते में मुश्किल से बदलता है, और एक ख़राब दिन इसमें नहीं दिखता।"]],
 [["Why two blood pressure numbers?","ब्लड प्रेशर में दो नंबर क्यों?"],
  ["The top number is the push when the heart squeezes; the bottom is the pressure left when it relaxes. Both matter, and in older adults the top number usually drives decisions. A single high reading in a clinic is common — the pattern over a week is what counts.",
   "ऊपर वाला नंबर वह दबाव है जब दिल सिकुड़ता है; नीचे वाला वह जो दिल के ढीले पड़ने पर बचा रहता है। दोनों मायने रखते हैं, और बड़ी उम्र में आमतौर पर ऊपर वाला फ़ैसले तय करता है। क्लिनिक में एक ऊँची रीडिंग आम बात है — हफ़्ते भर का पैटर्न मायने रखता है।"]],
 [["Good and bad cholesterol","अच्छा और खराब कोलेस्ट्रॉल"],
  ["LDL carries cholesterol out into the arteries, HDL carries it back to the liver. That is the whole reason one is called bad and the other good. Neither is read alone — your age, sugar and blood pressure go into the same calculation.",
   "LDL कोलेस्ट्रॉल को धमनियों की ओर ले जाता है, HDL उसे वापस लिवर तक लाता है। एक को खराब और दूसरे को अच्छा कहने की वजह बस यही है। कोई भी अकेले नहीं पढ़ा जाता — उम्र, शुगर और ब्लड प्रेशर सब उसी गणना में जाते हैं।"]],
 [["Why the plate rule works","थाली का नियम क्यों काम करता है"],
  ["Vegetables add volume without much carbohydrate, dal and paneer slow the meal down, and the roti or rice is what lifts sugar most. Filling the plate in that order means you eat less of the last thing without counting anything.",
   "सब्ज़ी थाली भरती है पर कार्बोहाइड्रेट कम देती है, दाल और पनीर खाने को धीमा करते हैं, और रोटी-चावल ही शुगर सबसे ज़्यादा चढ़ाते हैं। इसी क्रम में थाली भरने से आख़िरी चीज़ अपने आप कम खाई जाती है, बिना कुछ गिने।"]],
 [["BMI, and what it misses","BMI, और वह क्या छोड़ देता है"],
  ["BMI is weight divided by height squared — a quick sorting tool, nothing more. It cannot tell muscle from fat, and it says nothing about where the weight sits. Waist size often tells a doctor more, which is why it gets measured too.",
   "BMI यानी वज़न बँटा लंबाई का वर्ग — एक तेज़ छँटाई का औज़ार, इससे ज़्यादा कुछ नहीं। यह मांसपेशी और चर्बी में फ़र्क नहीं कर पाता, और यह भी नहीं बताता कि वज़न कहाँ जमा है। कमर का नाप अक्सर डॉक्टर को ज़्यादा बताता है, इसीलिए वह भी लिया जाता है।"]],
 [["What a risk score is not","जोखिम स्कोर क्या नहीं है"],
  ["A score like the one on your home page is a pattern found across thousands of people. It cannot see your medicines, your last month, or anything your doctor knows about you. Use it to watch your own numbers move, never to compare yourself with someone else.",
   "होम पेज जैसा स्कोर हज़ारों लोगों में मिला एक पैटर्न है। यह न आपकी दवाएँ देख सकता है, न आपका पिछला महीना, न वह सब जो आपके डॉक्टर को पता है। इसे अपने ही नंबरों की चाल देखने के लिए इस्तेमाल कीजिए, किसी और से तुलना के लिए कभी नहीं।"]],
 [["Type 1 and Type 2 are different illnesses","टाइप 1 और टाइप 2 अलग बीमारियाँ हैं"],
  ["In Type 1 the body stops making insulin and insulin is needed from the start. In Type 2 the body still makes it but responds poorly. MidTwin is built around Type 2 found at age 30 or later, and its comparisons do not fit Type 1.",
   "टाइप 1 में शरीर इंसुलिन बनाना बंद कर देता है और शुरू से ही इंसुलिन देना पड़ता है। टाइप 2 में शरीर बनाता तो है, पर उस पर ठीक से जवाब नहीं देता। MidTwin 30 साल या उसके बाद मिली टाइप 2 के आसपास बना है, और इसकी तुलनाएँ टाइप 1 पर लागू नहीं होतीं।"]],
 [["Why the same advice differs between two people","एक ही सलाह दो लोगों में अलग क्यों"],
  ["Guidelines set ranges, not rules. Age, how long you have had diabetes, kidney function, other illnesses and how often your sugar drops all shift the target. That is why your doctor's number for you can differ from the one printed in a chart.",
   "दिशानिर्देश दायरे तय करते हैं, नियम नहीं। उम्र, डायबिटीज़ कितने समय से है, गुर्दों की हालत, दूसरी बीमारियाँ और शुगर कितनी बार गिरती है — सब लक्ष्य बदल देते हैं। इसीलिए आपके डॉक्टर का बताया नंबर किसी चार्ट में छपे नंबर से अलग हो सकता है।"]]
];
function viewLearn(host){
  host.innerHTML=`
  <h1>${pick("Learn the words","शब्द समझिए")}</h1>
  <p class="mute" style="margin-top:8px">${pick(
    "Short explanations of everything this app puts in front of you. Open the ones you need; skip the rest.",
    "यह ऐप जो भी आपके सामने रखता है, उसकी छोटी-छोटी समझ। जो चाहिए खोलिए, बाकी छोड़ दीजिए।")}</p>
  <div style="margin-top:22px">
    ${LEARN.map(([t,b])=>`<details class="acc"><summary>${esc(pick(t[0],t[1]))}</summary><p>${esc(pick(b[0],b[1]))}</p></details>`).join("")}
  </div>
  <div class="card" style="margin-top:22px"><h3>${pick("Still unclear?","अब भी उलझन है?")}</h3><hr class="sep">
    <p class="mute">${pick("Ask it in your own words — the answer will use your numbers.","अपने शब्दों में पूछिए — जवाब आपके नंबरों से बनेगा।")}</p>
    <div class="row" style="margin-top:14px"><a class="btn" href="#/ask">${pick("Ask MidTwin","MidTwin से पूछें")}</a></div></div>`;
}

/* ======================= doctor visit ======================= */
const CHECKS=[
 ["a1c",["HbA1c done in the last 3–6 months","पिछले 3–6 महीनों में HbA1c हुआ"]],
 ["bp",["Blood pressure measured at this visit","इस मुलाक़ात में ब्लड प्रेशर नापा गया"]],
 ["lipid",["Cholesterol panel in the last year","पिछले साल में कोलेस्ट्रॉल की जाँच"]],
 ["kidney",["Kidney blood test and urine protein test","गुर्दों की खून की जाँच और पेशाब में प्रोटीन"]],
 ["eye",["Dilated eye examination on schedule","तय समय पर आँखों की जाँच"]],
 ["foot",["Feet examined, including sensation","पैरों की जाँच, सुन्नपन सहित"]],
 ["vacc",["Vaccinations up to date","टीके अद्यतन हैं"]],
 ["mood",["Mood and stress asked about","मन और तनाव के बारे में पूछा गया"]]
];
const QUESTIONS=[
 ["What is my personal HbA1c goal, and why that number?","मेरा अपना HbA1c लक्ष्य क्या है, और वही नंबर क्यों?"],
 ["Which of my numbers would you act on first?","मेरे किस नंबर पर आप पहले कदम उठाएँगे?"],
 ["Do any of my medicines risk dropping my sugar?","क्या मेरी कोई दवा शुगर गिरा सकती है?"],
 ["Was my urine protein test done, not just the blood one?","क्या मेरा पेशाब में प्रोटीन वाला टेस्ट भी हुआ, सिर्फ़ खून वाला नहीं?"],
 ["When is my next eye and foot check due?","मेरी अगली आँख और पैर की जाँच कब है?"],
 ["What would make you want to see me sooner?","ऐसा क्या हो जिस पर आप मुझे जल्दी बुलाना चाहेंगे?"]
];
function viewVisit(host){
  const nm=ME.numbers,checks=ME.checks||{};
  host.innerHTML=`
  <div class="row between"><h1>${pick("Take this to your doctor","यह डॉक्टर के पास ले जाइए")}</h1>
    <button class="chip noprint" id="printV">${pick("Print this page","यह पन्ना छापें")}</button></div>
  <p class="mute" style="margin-top:8px">${pick(
    "One sheet with your numbers, the questions worth asking, and a checklist of what a yearly review usually covers.",
    "एक पन्ने में आपके नंबर, पूछने लायक सवाल, और सालाना जाँच में आमतौर पर क्या-क्या होता है उसकी सूची।")}</p>

  <div class="card" style="margin-top:22px">
    <div class="row between"><h2>${esc(ME.name)}</h2><span class="mute small">${fmtDay(Date.now())}</span></div>
    <hr class="sep">
    <div class="scroll-x"><table>
      <tr><th>${pick("Number","नंबर")}</th><th>${pick("Value","मान")}</th><th>${pick("Usual comparison","सामान्य तुलना")}</th></tr>
      ${["hba1c","fasting","post","sbp","dbp","weight","hdl","ldl","creat"].map(k=>
        `<tr><td>${esc(labelOf(k))}</td><td><b>${esc(nm[k])}</b> ${esc(unitOf(k))}</td><td class="mute">${esc(pick(GOALS[k][0],GOALS[k][1]))}</td></tr>`).join("")}
      <tr><td>BMI</td><td><b>${bmiOf(nm)}</b> kg/m²</td><td class="mute">${esc(pick(GOALS.weight[0],GOALS.weight[1]))}</td></tr>
      <tr><td>${pick("Insulin","इंसुलिन")}</td><td><b>${nm.insulin==="1"?pick("Yes","हाँ"):pick("No","नहीं")}</b></td><td class="mute">—</td></tr>
    </table></div>
    ${ME.profile.about?`<p class="mute small" style="margin-top:14px"><b>${pick("Notes","टिप्पणी")}:</b> ${esc(ME.profile.about)}</p>`:""}
  </div>

  <div class="grid g-2" style="margin-top:18px">
    <div class="card"><h3>${pick("Questions worth asking","पूछने लायक सवाल")}</h3><hr class="sep">
      ${QUESTIONS.map(q=>`<p style="margin-bottom:10px">• ${esc(pick(q[0],q[1]))}</p>`).join("")}</div>
    <div class="card"><h3>${pick("Yearly review checklist","सालाना जाँच की सूची")}</h3><hr class="sep">
      ${CHECKS.map(([k,l])=>`<label class="check"><input type="checkbox" data-k="${k}"${checks[k]?" checked":""}><span>${esc(pick(l[0],l[1]))}</span></label>`).join("")}
      <p class="mute small" style="margin-top:12px">${pick("Ticks are saved on this device.","निशान इसी डिवाइस पर सेव रहते हैं।")}</p></div>
  </div>

  <p class="small mute" style="margin-top:16px">${pick(
    "Generated by MidTwin, a learning demo. The numbers above were entered by the patient and are not lab-verified.",
    "MidTwin, एक सीखने के डेमो से बना। ऊपर के नंबर मरीज़ ने खुद भरे हैं और लैब से सत्यापित नहीं हैं।")}</p>`;
  host.querySelectorAll(".check input").forEach(c=>c.onchange=()=>{
    ME.checks=ME.checks||{};ME.checks[c.dataset.k]=c.checked;saveMe()});
  $("#printV").onclick=()=>window.print();
}

/* ======================= profile ======================= */
function viewProfile(host){
  const p=ME.profile;
  host.innerHTML=`
  <h1>${pick("Your profile","आपकी प्रोफ़ाइल")}</h1>
  <p class="mute" style="margin-top:8px">${pick("Everything here stays in this browser. Nothing is sent anywhere.","यह सब इसी ब्राउज़र में रहता है। कहीं कुछ नहीं भेजा जाता।")}</p>
  <div class="grid g-2" style="margin-top:22px">
    <form class="card" id="pf">
      <div class="photopick" style="margin-bottom:20px">
        ${avatar(ME,"width:88px;height:88px;font-size:2rem")}
        <div style="flex:1;min-width:180px">
          <label for="pp">${pick("Your photo","आपकी फ़ोटो")}</label>
          <input id="pp" type="file" accept="image/*">
          <span class="hint">${pick("Cropped square and kept small, in this browser only.","चौकोर काटकर छोटी रखी जाती है, सिर्फ़ इसी ब्राउज़र में।")}</span>
          ${ME.photo?`<button type="button" class="chip" id="rmp" style="margin-top:10px">${pick("Remove photo","फ़ोटो हटाएँ")}</button>`:""}
        </div>
      </div>
      <div class="field"><label for="pn">${pick("Name","नाम")}</label><input id="pn" value="${esc(ME.name)}"></div>
      <div class="grid g-auto">
        <div class="field"><label for="ps">${pick("Sex","लिंग")}</label><select id="ps">
          <option value="female"${p.sex==="female"?" selected":""}>${pick("Female","महिला")}</option>
          <option value="male"${p.sex==="male"?" selected":""}>${pick("Male","पुरुष")}</option></select></div>
        <div class="field"><label for="pc">${pick("City","शहर")}</label><input id="pc" value="${esc(p.city||"")}"></div>
      </div>
      <div class="grid g-auto">
        <div class="field"><label for="pph">${pick("Phone","फ़ोन")}</label><input id="pph" value="${esc(p.phone||"")}" placeholder="${pick("Optional","वैकल्पिक")}"></div>
        <div class="field"><label for="psi">${pick("Diabetes since","डायबिटीज़ कब से")}</label><input id="psi" value="${esc(p.since||"")}" placeholder="${pick("E.g. 2019","जैसे 2019")}"></div>
      </div>
      <div class="field"><label for="pa">${pick("Anything your doctor should know","जो डॉक्टर को पता होना चाहिए")}</label>
        <textarea id="pa" placeholder="${pick("Other conditions, medicines, allergies.","दूसरी बीमारियाँ, दवाएँ, एलर्जी।")}">${esc(p.about||"")}</textarea></div>
      <button class="btn" type="submit">${pick("Save changes","बदलाव सेव करें")}</button>
    </form>

    <div class="stack">
      <div class="card"><h3>${pick("Account","खाता")}</h3><hr class="sep">
        <p class="mute small">${pick("Username","यूज़रनेम")} <b>${esc(ME.id)}</b> · ${pick("Email","ईमेल")} <b>${esc(ME.email||"—")}</b> · ${pick("joined","जुड़े")} ${fmtDate(ME.created)}</p>
        <div class="grid g-auto" style="margin-top:14px">
          <div class="field"><label for="op">${pick("Current password","मौजूदा पासवर्ड")}</label><input id="op" type="password"></div>
          <div class="field"><label for="np">${pick("New password","नया पासवर्ड")}</label><input id="np" type="password"></div>
        </div>
        <button class="chip" id="chpw">${pick("Change password","पासवर्ड बदलें")}</button>
        <span class="err hide" id="pwmsg"></span></div>
      <div class="card"><h3>${pick("Your data","आपका डेटा")}</h3><hr class="sep">
        <p class="mute small">${(ME.history||[]).length} ${pick("saved questions","सहेजे सवाल")} · ${(ME.snaps||[]).length} ${pick("snapshots","स्नैपशॉट")} · ${pick("food plan","खाने की योजना")} ${ME.diet?pick("built","बनी"):pick("not built yet","अभी नहीं बनी")}</p>
        <div class="row" style="margin-top:14px">
          <button class="chip" id="exp">${pick("Download my data","मेरा डेटा देखें")}</button>
          <button class="chip" id="del" style="border-color:#d9534f;color:#c0392b">${pick("Delete my account","मेरा खाता मिटाएँ")}</button></div></div>
      <div class="card"><h3>${pick("Appearance","दिखावट")}</h3><hr class="sep">
        <div class="row"><button class="chip" id="tL">${pick("Light","दिन")}</button><button class="chip" id="tD">${pick("Dark","रात")}</button>
        <button class="chip" id="tS">${pick("Match my device","डिवाइस जैसा")}</button></div></div>
    </div>
  </div>`;
  $("#pp").onchange=e=>readPhoto(e.target.files[0],d=>{ME.photo=d;saveMe();render()});
  const rm=$("#rmp");if(rm)rm.onclick=()=>{ME.photo="";saveMe();render()};
  $("#pf").onsubmit=e=>{
    e.preventDefault();
    ME.name=$("#pn").value.trim()||ME.name;
    ME.profile={sex:$("#ps").value,city:$("#pc").value.trim(),phone:$("#pph").value.trim(),
      since:$("#psi").value.trim(),about:$("#pa").value.trim()};
    saveMe();render();
  };
  $("#chpw").onclick=()=>{
    const m=$("#pwmsg");m.classList.remove("hide");
    if($("#op").value!==ME.pw){m.style.color="#c0392b";m.textContent=pick("Current password is wrong.","मौजूदा पासवर्ड गलत है।");return}
    if($("#np").value.length<4){m.style.color="#c0392b";m.textContent=pick("New password needs at least 4 characters.","नए पासवर्ड में कम से कम 4 अक्षर चाहिए।");return}
    ME.pw=$("#np").value;saveMe();m.style.color="var(--g2)";m.textContent=pick("Password changed.","पासवर्ड बदल गया।");
    $("#op").value=$("#np").value="";
  };
  $("#tL").onclick=()=>{document.documentElement.setAttribute("data-theme","light");DB.set(KEY_T,"light")};
  $("#tD").onclick=()=>{document.documentElement.setAttribute("data-theme","dark");DB.set(KEY_T,"dark")};
  $("#tS").onclick=()=>{document.documentElement.removeAttribute("data-theme");DB.del(KEY_T)};
  $("#exp").onclick=()=>{
    const data={name:ME.name,profile:ME.profile,numbers:ME.numbers,snaps:ME.snaps,dietPrefs:ME.dietPrefs,
      history:(ME.history||[]).map(h=>({q:h.q,a:h.plain,t:h.t}))};
    const w=window.open("","_blank");
    if(w){w.document.write("<pre style='font:13px ui-monospace,monospace;white-space:pre-wrap;padding:20px'>"+esc(JSON.stringify(data,null,2))+"</pre>");w.document.title="MidTwin data"}
    else alert(JSON.stringify(data,null,2));
  };
  $("#del").onclick=()=>{
    if(!confirm(pick("This deletes your account, numbers, questions and plans from this browser. Continue?","इससे आपका खाता, नंबर, सवाल और योजनाएँ इस ब्राउज़र से मिट जाएँगी। जारी रखें?")))return;
    const all=users();delete all[ME.id];saveUsers(all);DB.del(KEY_S);location.hash="#/home";render();
  };
}
function readPhoto(file,cb){
  if(!file)return;
  const fr=new FileReader();
  fr.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const s=256,c=document.createElement("canvas");c.width=c.height=s;
      const side=Math.min(img.width,img.height);
      c.getContext("2d").drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,s,s);
      cb(c.toDataURL("image/jpeg",.82));
    };
    img.onerror=()=>cb(fr.result);
    img.src=fr.result;
  };
  fr.readAsDataURL(file);
}

/* ======================= cursor + living background ======================= */
let FX=null;
function startFx(){
  if(FX)return;
  if(!matchMedia("(hover:hover) and (pointer:fine)").matches)return;
  if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;
  const c=document.createElement("canvas");c.id="fx";document.body.prepend(c);
  const orb=document.createElement("div");orb.id="orb";
  const ring=document.createElement("div");ring.id="ring";
  const dot=document.createElement("div");dot.id="dot";
  document.body.append(orb,ring,dot);
  document.documentElement.classList.add("cur");
  const x=c.getContext("2d");
  let W=0,H=0,P=[],m={x:innerWidth/2,y:innerHeight/2},r={x:m.x,y:m.y};
  const col=()=>getComputedStyle(document.documentElement).getPropertyValue("--dot").trim()||"rgba(47,158,110,.55)";
  const rgba=(a)=>{const b=col().match(/[\d.]+/g);return b?`rgba(${b[0]},${b[1]},${b[2]},${a})`:`rgba(47,158,110,${a})`};
  const size=()=>{W=c.width=innerWidth;H=c.height=innerHeight;
    P=Array.from({length:Math.min(96,(W/14)|0)},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28}))};
  size();addEventListener("resize",size);
  addEventListener("pointermove",e=>{m.x=e.clientX;m.y=e.clientY;orb.style.left=m.x+"px";orb.style.top=m.y+"px";dot.style.left=m.x+"px";dot.style.top=m.y+"px"});
  addEventListener("pointerdown",()=>dot.style.transform="translate(-50%,-50%) scale(2.2)");
  addEventListener("pointerup",()=>dot.style.transform="translate(-50%,-50%)");
  (function loop(){
    r.x+=(m.x-r.x)*.16;r.y+=(m.y-r.y)*.16;
    ring.style.left=r.x+"px";ring.style.top=r.y+"px";
    x.clearRect(0,0,W,H);
    for(let i=0;i<P.length;i++){
      const p=P[i],dx=m.x-p.x,dy=m.y-p.y,d=Math.hypot(dx,dy)||1;
      if(d<230){p.vx+=dx/d*.012;p.vy+=dy/d*.012}
      p.vx*=.99;p.vy*=.99;p.x=(p.x+p.vx+W)%W;p.y=(p.y+p.vy+H)%H;
      x.fillStyle=rgba(d<230?.75:.28);
      x.beginPath();x.arc(p.x,p.y,d<230?2.3:1.4,0,7);x.fill();
      for(let k=i+1;k<P.length;k++){
        const q=P[k],e=Math.hypot(p.x-q.x,p.y-q.y);
        if(e<115){x.strokeStyle=rgba((1-e/115)*(d<230?.5:.14));x.lineWidth=1;
          x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}
      }
    }
    requestAnimationFrame(loop);
  })();
  FX={ring,dot,orb};
}
function bindFx(){
  if(!FX)return;
  const {ring}=FX;
  document.querySelectorAll("a,button,.chip,.card,.btn,input,textarea,select,summary").forEach(e=>{
    if(e._fx)return;e._fx=1;
    const isField=/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName);
    e.addEventListener("pointerenter",()=>{ring.classList.add(isField?"bar":"big");if(FX.dot)FX.dot.classList.add("fade")});
    e.addEventListener("pointerleave",()=>{ring.classList.remove("big","bar");if(FX.dot)FX.dot.classList.remove("fade");e.style.transform=""});
    e.addEventListener("pointermove",ev=>{
      const b=e.getBoundingClientRect(),px=(ev.clientX-b.left)/b.width,py=(ev.clientY-b.top)/b.height;
      e.style.setProperty("--mx",px*100+"%");e.style.setProperty("--my",py*100+"%");
      if(e.classList.contains("card"))e.style.transform=`perspective(900px) rotateY(${(px-.5)*5}deg) rotateX(${(.5-py)*5}deg)`;
      else if(e.classList.contains("btn"))e.style.transform=`translate(${(px-.5)*8}px,${(py-.5)*8}px)`;
    });
  });
}

/* ======================= boot ======================= */
const savedTheme=DB.get(KEY_T,null);
if(savedTheme)document.documentElement.setAttribute("data-theme",savedTheme);
if(!location.hash)location.hash="#/home";
startFx();
render();
