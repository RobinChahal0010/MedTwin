const F=[['age','Your age','years',58],['bmi','Weight index (BMI)','from height and weight',31.4],['hba1c','Sugar, 3-month average (HbA1c)','shown as %',7.9],['sbp','Blood pressure, top number','mmHg',142],['dbp','Blood pressure, bottom number','mmHg',84],['chol','Total cholesterol','mg/dL',198],['hdl','Good cholesterol (HDL)','mg/dL',38],['creat','Kidney check (creatinine)','mg/dL',1.0]];
fields.innerHTML=F.map(([k,l,h,v])=>`<div><label for="${k}">${l}</label><input id="${k}" name="${k}" type="number" step="any" value="${v}"><span class="hint">${h}</span></div>`).join('')+'<div><label for="ins">Do you take insulin?</label><select id="ins" name="ins"><option value="0">No</option><option value="1">Yes</option></select></div>';
let file;fi.onchange=()=>{file=fi.files[0];fn.textContent=file?.name||''};
dz.ondragover=e=>{e.preventDefault();dz.classList.add('hov')};dz.ondragleave=()=>dz.classList.remove('hov');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('hov');file=e.dataTransfer.files[0];fn.textContent=file?.name||''};
f.onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(f));
if(v.sbp>300||v.sbp<60||v.bmi>90||v.bmi<10||v.hba1c>20||v.hba1c<3){alert('One number looks wrong. Please check blood pressure, BMI and sugar (HbA1c).');return}
sessionStorage.twin=JSON.stringify(await API.upload(v,file));location='twin.html'};
