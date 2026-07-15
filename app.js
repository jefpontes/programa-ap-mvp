
import {STORES,get,getAll,put,bulkPut,exportDatabase,importDatabase,seedDatabase} from "./db.js";
import {weightedScore,scoreLabel,areaScore,calculateConsultation,validateLots,money} from "./calculations.js";
import {renderPresentation} from "./presentation.js";
import {exportPresentationPDF,buildCommercialSummary} from "./pdf.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$("#app"),modalRoot=$("#modal-root"),fileInput=$("#global-file-input");
let settings=null,master=[],current=null,currentStep="condominium",saveTimer=null;

const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const field=(label,name,value="",type="text",extra="")=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const select=(label,name,value,options)=>`<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options.map(o=>`<option value="${esc(o)}" ${o===value?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
const textarea=(label,name,value="")=>`<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}">${esc(value)}</textarea></div>`;

function toast(message){const el=document.createElement("div");el.className="toast";el.textContent=message;$("#toast-region").append(el);setTimeout(()=>el.remove(),3000)}
function download(name,content,type="application/json"){
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function photoInput(name,value,label="Foto"){
 return `<div class="photo-field"><div class="field"><label>${label}</label><input name="${name}" type="file" accept="image/*" capture="environment"></div>${value?`<img class="photo-preview" src="${value}" alt="${label}">`:""}</div>`;
}
async function fileToDataURL(file,max=1600){
 return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>{
   const img=new Image();img.onload=()=>{
    const scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");
    canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    resolve(canvas.toDataURL("image/jpeg",.78));
   };img.src=r.result;
  };r.readAsDataURL(file);
 });
}
function blankConsultation(){
 return {id:uid(),planNumber:`AP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,date:now(),updatedAt:now(),version:"1.0",status:"active",
 condominium:{},briefing:{},areas:[],decision:{},selectedPlan:"12",manualAdjustment:null};
}
async function saveCurrent(show=false){
 if(!current)return;current.updatedAt=now();await put(STORES.consultations,current);
 const s=$("#consultation-save-status");if(s)s.textContent="Dados salvos localmente";
 if(show)toast("Consultoria salva no dispositivo.");
}
function scheduleSave(){const s=$("#consultation-save-status");if(s)s.textContent="Salvando...";clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveCurrent(),500)}
function bindAutoSave(root=document){
 root.oninput=e=>{
  if(e.target.matches("input,select,textarea")) scheduleSave();
 };
 root.onchange=async e=>{
  if(e.target.type==="file"&&e.target.files?.[0]){
   const data=await fileToDataURL(e.target.files[0]);
   const img=e.target.closest(".photo-field")?.querySelector("img")||document.createElement("img");
   img.className="photo-preview";img.src=data;if(!img.parentNode)e.target.closest(".photo-field").append(img);
  }
 };
}
function setConnection(){
 const el=$("#connection-status");if(!el)return;
 el.textContent=navigator.onLine?"Online — dados locais":"Offline — pronto para uso";
 el.className=`status-badge ${navigator.onLine?"online":"offline"}`;
}
async function init(){
 await seedDatabase();settings=await get(STORES.settings,"app");master=await getAll(STORES.master);
 setConnection();addEventListener("online",setConnection);addEventListener("offline",setConnection);
 if("serviceWorker"in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);
 showHome();
}
function showHome(){
 current=null;currentStep="condominium";$("#header-back-button").classList.add("is-hidden");
 app.innerHTML=$("#home-template").innerHTML;
}
function showConsultation(){
 app.innerHTML=$("#consultation-shell-template").innerHTML;$("#sidebar-condominium-name").textContent=current.condominium?.name||"Novo condomínio";
 $("#header-back-button").classList.remove("is-hidden");renderStep();bindAutoSave($("#consultation-content"));
}
function renderStep(){
 $$(".step-navigation__item").forEach(x=>x.classList.toggle("is-active",x.dataset.step===currentStep));
 const target=$("#consultation-content");if(!target)return;
 const map={condominium:renderCondominium,briefing:renderBriefing,survey:renderSurvey,financial:renderFinancial,presentation:renderPresentationStep,decision:renderDecision};
 target.innerHTML=map[currentStep]();target.scrollTop=0;bindStepEvents();
}
function nav(step){collectVisibleForm();currentStep=step;saveCurrent();renderStep()}
function collectVisibleForm(){
 const form=$("#step-form");if(!form||!current)return;
 const data=Object.fromEntries(new FormData(form).entries());
 if(currentStep==="condominium"){
  const photo=form.querySelector('[name="facadePhoto"]')?.closest(".photo-field")?.querySelector("img")?.src||current.condominium.facadePhoto||"";
  current.condominium={...current.condominium,...data,facadePhoto:photo};
 }else if(currentStep==="briefing"){
  current.briefing={...current.briefing,...data,
   environmentEstimate:Number(data.environmentEstimate)||0,
   modernizationInterest:form.modernizationInterest?.checked||false,
   expansionInterest:form.expansionInterest?.checked||false,
   customProjectInterest:form.customProjectInterest?.checked||false};
 }else if(currentStep==="decision"){
  current.decision={...current.decision,...data};
  current.selectedPlan=data.selectedPlan||current.selectedPlan;
 }
}
function renderCondominium(){
 const c=current.condominium||{};
 return `<div class="section-header"><div><span class="eyebrow">Etapa 1</span><h1>Cadastro do condomínio</h1><p>Dados básicos da consultoria e da tomada de decisão.</p></div></div>
 <form id="step-form" class="card">
  <div class="grid grid-2">${field("Nome do condomínio","name",c.name,"text","required")}${field("CNPJ","cnpj",c.cnpj)}
  ${field("Endereço","address",c.address)}${field("Cidade","city",c.city)}
  ${field("Estado","state",c.state)}${field("Responsável pelo agendamento","scheduleContact",c.scheduleContact)}
  ${field("Telefone","phone",c.phone,"tel")}${field("Responsável que acompanhou a vistoria","inspectionCompanion",c.inspectionCompanion)}
  ${field("Tomador de decisão","decisionMaker",c.decisionMaker)}${field("Cargo do tomador de decisão","decisionRole",c.decisionRole)}
  ${select("Processo de aprovação","approvalProcess",c.approvalProcess||"Síndico",["Síndico","Conselho","Assembleia","Administradora","Diretoria","Outro"])}</div>
  <div style="margin-top:18px">${photoInput("facadePhoto",c.facadePhoto,"Foto da fachada")}</div>
  <div class="actions"><button type="button" class="button button--primary" data-next="briefing">Salvar e continuar</button></div>
 </form>`;
}
function renderBriefing(){
 const b=current.briefing||{};
 return `<div class="section-header"><div><span class="eyebrow">Etapa 2</span><h1>Briefing rápido</h1><p>Referências iniciais para priorização e apresentação.</p></div></div>
 <form id="step-form" class="card"><div class="grid grid-2">
 ${select("Tipo de condomínio","condominiumType",b.condominiumType||"Residencial",["Residencial","Comercial","Misto","Resort/hotel","Outro"])}
 ${select("Grau de utilização","usageLevel",b.usageLevel||"Médio",["Baixo","Médio","Alto"])}
 ${select("Perfil de uso","usageProfile",b.usageProfile||"Residencial",["Residencial","Misto","Locação por temporada/Airbnb","Resort/hotel"])}
 ${field("Quantidade estimada de ambientes","environmentEstimate",b.environmentEstimate||"","number",'min="0"')}
 ${field("Ambiente prioritário indicado","priorityEnvironment",b.priorityEnvironment||"")}
 </div>
 <div class="checkbox-row" style="margin-top:18px">
 <label class="check"><input type="checkbox" name="modernizationInterest" ${b.modernizationInterest?"checked":""}> Interesse em modernização</label>
 <label class="check"><input type="checkbox" name="expansionInterest" ${b.expansionInterest?"checked":""}> Interesse em ampliação</label>
 <label class="check"><input type="checkbox" name="customProjectInterest" ${b.customProjectInterest?"checked":""}> Interesse em projeto personalizado</label></div>
 <div style="margin-top:18px">${textarea("Observação geral","generalNote",b.generalNote||"")}</div>
 <div class="actions"><button type="button" class="button button--ghost" data-next="condominium">Voltar</button><button type="button" class="button button--primary" data-next="survey">Salvar e continuar</button></div></form>`;
}
function renderSurvey(){
 const diag=weightedScore(current.areas.flatMap(a=>a.sets||[]));
 return `<div class="section-header"><div><span class="eyebrow">Etapa 3</span><h1>Levantamento</h1><p>${current.areas.length} ambientes cadastrados · ${diag.totalPieces} peças avaliadas.</p></div><button class="button button--primary" data-action="add-area">Adicionar ambiente</button></div>
 <div class="list">${current.areas.length?current.areas.map(a=>areaCard(a)).join(""):`<div class="card"><p>Nenhum ambiente cadastrado.</p></div>`}</div>
 <div class="actions"><button class="button button--ghost" data-next="briefing">Voltar</button><button class="button button--primary" data-next="financial">Calcular estimativa</button></div>`;
}
function areaCard(a){
 const s=areaScore(a);
 return `<article class="card"><div class="section-header"><div><h2>${esc(a.name)}</h2><p>${a.sets?.length||0} conjuntos · ${s.totalPieces} peças · Score ${s.score.toFixed(1)}</p></div><div class="list-item__actions"><button class="button button--ghost" data-edit-area="${a.id}">Editar</button><button class="button button--secondary" data-add-set="${a.id}">Adicionar conjunto</button></div></div>
 ${a.photo?`<img class="photo-preview" src="${a.photo}" alt="">`:""}
 <div class="list" style="margin-top:14px">${(a.sets||[]).map(set=>`<div class="list-item"><div><strong>${esc(set.family)} — ${esc(set.characteristic)}</strong><div class="list-item__meta">${esc(set.material)} · ${set.quantity} unidades · ${set.conditionMode==="lots"?"Condição por lotes":`Condição ${set.condition}`}</div></div><div class="list-item__actions"><button class="button button--ghost" data-edit-set="${set.id}" data-area="${a.id}">Editar</button><button class="button button--ghost" data-archive-set="${set.id}" data-area="${a.id}">Arquivar</button></div></div>`).join("")||"<p>Nenhum conjunto cadastrado.</p>"}</div></article>`;
}
function renderFinancial(){
 const f=calculateConsultation(current,master,settings),diag=weightedScore(current.areas.flatMap(a=>a.sets||[]));
 return `<div class="section-header"><div><span class="eyebrow">Etapa 4</span><h1>Estimativa financeira</h1><p>Valores calculados exclusivamente pela tabela mestre local.</p></div></div>
 <div class="kpi-grid"><div class="kpi"><small>Score</small><strong>${diag.score.toFixed(1)}</strong></div><div class="kpi"><small>Valor recomendado</small><strong>${money(f.presentedTotal)}</strong></div><div class="kpi"><small>Reposição estimada</small><strong>${money(f.market)}</strong></div><div class="kpi"><small>Economia estimada</small><strong>${money(f.economy)}</strong></div></div>
 <div class="card"><h2>Detalhamento por ambiente</h2><div class="table-wrap"><table><thead><tr><th>Ambiente</th><th>Família</th><th>Modalidade</th><th>Quantidade</th><th>Valor</th></tr></thead><tbody>${f.details.map(x=>`<tr><td>${esc(x.areaName)}</td><td>${esc(x.family)}</td><td>${esc(x.modality)}</td><td>${x.quantity}</td><td>${x.missingPrice?"Preço não cadastrado":money(x.commercial)}</td></tr>`).join("")}</tbody></table></div></div>
 <div class="grid grid-2"><div class="card"><h2>Plano 12</h2><p>Implantação ${f.plan12.percent}%: <strong>${money(f.plan12.implementation)}</strong></p><p>${f.plan12.installments} parcelas de <strong>${money(f.plan12.installmentValue)}</strong></p></div><div class="card card--gold"><h2>Plano 24</h2><p>Implantação ${f.plan24.percent}%: <strong>${money(f.plan24.implementation)}</strong></p><p>${f.plan24.installments} parcelas de <strong>${money(f.plan24.installmentValue)}</strong></p></div></div>
 <div class="actions"><button class="button button--ghost" data-next="survey">Voltar</button><button class="button button--primary" data-next="presentation">Gerar apresentação</button></div>`;
}
function renderPresentationStep(){
 return `<div class="section-header"><div><span class="eyebrow">Etapa 5</span><h1>Plano Executivo AP</h1><p>A apresentação usa os dados atuais da consultoria.</p></div></div><div class="card card--gold"><h2>Apresentação 16:9 pronta</h2><p>Abra em tela cheia, navegue pelas páginas e gere o PDF usando o mesmo layout.</p><div class="actions" style="justify-content:flex-start"><button class="button button--primary" data-action="open-presentation">Abrir apresentação</button><button class="button button--secondary" data-action="print-summary">Resumo comercial</button></div></div><div class="actions"><button class="button button--ghost" data-next="financial">Voltar</button><button class="button button--primary" data-next="decision">Registrar decisão</button></div>`;
}
function renderDecision(){
 const d=current.decision||{};
 return `<div class="section-header"><div><span class="eyebrow">Etapa 6</span><h1>Decisão comercial</h1><p>Registre o resultado da reunião sem excluir o histórico.</p></div></div>
 <form id="step-form" class="card"><div class="grid grid-2">
 ${select("Situação","status",d.status||"Retornar",["Fechado","Conselho","Assembleia","Retornar","Perdido"])}
 ${select("Escopo","scope",d.scope||"Programa completo",["Programa completo","Implantação por etapas"])}
 ${select("Plano escolhido","selectedPlan",current.selectedPlan||"12",["12","24"])}
 ${field("Área inicial","initialArea",d.initialArea||"")}
 ${field("Próxima data","nextDate",d.nextDate||"","date")}
 </div><div style="margin-top:18px">${textarea("Observação","note",d.note||"")}</div>
 <div class="actions"><button type="button" class="button button--ghost" data-next="presentation">Voltar</button><button type="button" class="button button--primary" data-action="finish-consultation">Salvar resultado</button></div></form>`;
}
function bindStepEvents(){
 $$("[data-next]").forEach(b=>b.onclick=()=>nav(b.dataset.next));
 $("[data-action='add-area']")?.addEventListener("click",()=>openAreaModal());
 $$("[data-edit-area]").forEach(b=>b.onclick=()=>openAreaModal(current.areas.find(a=>a.id===b.dataset.editArea)));
 $$("[data-add-set]").forEach(b=>b.onclick=()=>openSetModal(b.dataset.addSet));
 $$("[data-edit-set]").forEach(b=>b.onclick=()=>{const a=current.areas.find(x=>x.id===b.dataset.area);openSetModal(a.id,a.sets.find(x=>x.id===b.dataset.editSet))});
 $$("[data-archive-set]").forEach(b=>b.onclick=()=>{const a=current.areas.find(x=>x.id===b.dataset.area);const s=a.sets.find(x=>x.id===b.dataset.archiveSet);s.status="archived";a.sets=a.sets.filter(x=>x.status!=="archived");saveCurrent();renderStep()});
 $("[data-action='open-presentation']")?.addEventListener("click",openPresentation);
 $("[data-action='print-summary']")?.addEventListener("click",printSummary);
 $("[data-action='finish-consultation']")?.addEventListener("click",()=>{collectVisibleForm();current.status=current.decision.status==="Perdido"?"cancelled":"active";saveCurrent(true);showHome()});
}
function openAreaModal(area=null){
 const a=area||{id:uid(),name:"Piscina",note:"",requestedPriority:false,photo:"",sets:[],status:"active"};
 modalRoot.innerHTML=`<div class="modal-backdrop" data-close></div><section class="modal"><header class="modal__header"><h2>${area?"Editar":"Adicionar"} ambiente</h2><button class="icon-button icon-button--ghost" data-close>×</button></header><form id="area-form"><div class="modal__body"><div class="grid grid-2">${select("Área","name",a.name,["Piscina","Área gourmet","Lounge","Sauna","Rooftop","Solário","Outro"])}${field("Nome personalizado","customName",a.customName||"")}</div><label class="check" style="margin:16px 0"><input type="checkbox" name="requestedPriority" ${a.requestedPriority?"checked":""}> Prioridade solicitada pelo responsável</label>${textarea("Observação curta","note",a.note)}${photoInput("photo",a.photo,"Foto geral da área")}</div><footer class="modal__footer"><button type="button" class="button button--ghost" data-close>Cancelar</button><button class="button button--primary">Salvar ambiente</button></footer></form></section>`;
 $$("[data-close]",modalRoot).forEach(x=>x.onclick=()=>modalRoot.innerHTML="");
 $("#area-form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),photo=e.target.querySelector(".photo-preview")?.src||a.photo||"";a.name=fd.get("name")==="Outro"?(fd.get("customName")||"Outro"):fd.get("name");a.customName=fd.get("customName");a.note=fd.get("note");a.requestedPriority=e.target.requestedPriority.checked;a.photo=photo;if(!area)current.areas.push(a);await saveCurrent();modalRoot.innerHTML="";renderStep()};
 modalRoot.querySelector('input[type="file"]').onchange=async e=>{const data=await fileToDataURL(e.target.files[0]);let im=e.target.closest(".photo-field").querySelector("img");if(!im){im=document.createElement("img");im.className="photo-preview";e.target.closest(".photo-field").append(im)}im.src=data};
}
function openSetModal(areaId,set=null){
 const area=current.areas.find(a=>a.id===areaId);
 const s=set||{id:uid(),family:"Espreguiçadeira",characteristic:"Tubo",material:"Tela",quantity:1,conditionMode:"single",condition:3,conditionLots:[],isExpansion:false,status:"active"};
 const families=settings.families.filter(x=>x.active).map(x=>x.name),materials=settings.materials.filter(x=>x.active).map(x=>x.name);
 const chars=settings.characteristics[s.family]||["Outro"];
 modalRoot.innerHTML=`<div class="modal-backdrop" data-close></div><section class="modal"><header class="modal__header"><h2>${set?"Editar":"Adicionar"} conjunto</h2><button class="icon-button icon-button--ghost" data-close>×</button></header><form id="set-form"><div class="modal__body"><div class="grid grid-2">${select("Família","family",s.family,families)}${select("Característica construtiva","characteristic",s.characteristic,chars)}${select("Material","material",s.material,materials)}${field("Quantidade total","quantity",s.quantity,"number",'min="1" required')}</div><div style="margin-top:16px">${select("Classificação","conditionMode",s.conditionMode,["single","lots"])}</div><div id="condition-editor" style="margin-top:14px"></div><label class="check" style="margin-top:16px"><input type="checkbox" name="isExpansion" ${s.isExpansion?"checked":""}> Item de ampliação / venda nova</label>${photoInput("photo",s.photo,"Foto opcional do conjunto")}</div><footer class="modal__footer"><button type="button" class="button button--ghost" data-close>Cancelar</button><button class="button button--primary">Salvar conjunto</button></footer></form></section>`;
 const form=$("#set-form"),editor=$("#condition-editor");
 function drawCondition(){
  const mode=form.conditionMode.value;
  if(mode==="single")editor.innerHTML=select("Condição geral","condition",String(s.condition||3),["5","4","3","2","1"]);
  else editor.innerHTML=`<p>Informe as quantidades por condição. A soma deve ser igual ao total.</p><div class="grid grid-3">${[5,4,3,2,1].map(c=>field(`${c} — ${["","Crítico","Ruim","Regular","Bom","Excelente"][c]}`,`lot_${c}`,(s.conditionLots.find(l=>Number(l.condition)===c)?.quantity)||0,"number",'min="0"')).join("")}</div>`;
 }
 drawCondition();form.conditionMode.onchange=drawCondition;
 form.family.onchange=()=>{const values=settings.characteristics[form.family.value]||["Outro"];form.characteristic.innerHTML=values.map(x=>`<option>${esc(x)}</option>`).join("")};
 $$("[data-close]",modalRoot).forEach(x=>x.onclick=()=>modalRoot.innerHTML="");
 form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),photo=form.querySelector(".photo-preview")?.src||s.photo||"";s.family=fd.get("family");s.characteristic=fd.get("characteristic");s.material=fd.get("material");s.quantity=Number(fd.get("quantity"));s.conditionMode=fd.get("conditionMode");s.isExpansion=form.isExpansion.checked;s.photo=photo;
  if(s.conditionMode==="single"){s.condition=Number(fd.get("condition"));s.conditionLots=[]}else{s.conditionLots=[5,4,3,2,1].map(c=>({condition:c,quantity:Number(fd.get(`lot_${c}`))||0})).filter(x=>x.quantity>0)}
  if(!validateLots(s)){toast("A soma dos lotes deve ser igual à quantidade total.");return}
  if(!set)area.sets.push(s);await saveCurrent();modalRoot.innerHTML="";renderStep()
 };
 form.querySelector('input[type="file"]').onchange=async e=>{const data=await fileToDataURL(e.target.files[0]);let im=e.target.closest(".photo-field").querySelector("img");if(!im){im=document.createElement("img");im.className="photo-preview";e.target.closest(".photo-field").append(im)}im.src=data};
}
function openPresentation(){
 collectVisibleForm();const f=calculateConsultation(current,master,settings);
 if(current.areas.length===0){toast("Cadastre ao menos um ambiente.");return}
 const host=document.createElement("div");host.id="presentation-root";document.body.append(host);renderPresentation(host,current,f,settings);
}
function printSummary(){
 const f=calculateConsultation(current,master,settings),w=open("","_blank");w.document.write(`<html><head><title>Resumo comercial</title><style>body{font-family:Arial;padding:40px;max-width:800px;margin:auto}h1{color:#2B2B2B}</style></head><body>${buildCommercialSummary(current,f)}<script>print()<\/script></body></html>`);w.document.close();
}
async function showConsultations(){
 const rows=(await getAll(STORES.consultations)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 app.innerHTML=`<section class="screen"><div class="section-header"><div><span class="eyebrow">Registros locais</span><h1>Consultorias salvas</h1></div><button class="button button--primary" data-action="new-consultation">Nova consultoria</button></div><div class="list">${rows.length?rows.map(c=>`<div class="list-item"><div><strong>${esc(c.condominium?.name||"Sem nome")}</strong><div class="list-item__meta">${new Date(c.updatedAt).toLocaleString("pt-BR")} · ${esc(c.decision?.status||"Em andamento")} · ${esc(c.status)}</div></div><div class="list-item__actions"><button class="button button--primary" data-open="${c.id}">Abrir</button><button class="button button--ghost" data-archive="${c.id}">${c.status==="archived"?"Reativar":"Arquivar"}</button></div></div>`).join(""):$("#empty-state-template").innerHTML}</div></section>`;
 $$("[data-open]").forEach(b=>b.onclick=async()=>{current=await get(STORES.consultations,b.dataset.open);showConsultation()});
 $$("[data-archive]").forEach(b=>b.onclick=async()=>{const c=await get(STORES.consultations,b.dataset.archive);c.status=c.status==="archived"?"active":"archived";await put(STORES.consultations,c);showConsultations()});
}
function askAdmin(onSuccess){
 modalRoot.innerHTML=`<div class="modal-backdrop"></div><section class="modal"><header class="modal__header"><h2>Acesso administrativo</h2></header><form id="admin-login"><div class="modal__body">${field("Senha","password","","password",'required')}</div><footer class="modal__footer"><button type="button" class="button button--ghost" data-close>Cancelar</button><button class="button button--primary">Entrar</button></footer></form></section>`;
 $("[data-close]",modalRoot).onclick=()=>modalRoot.innerHTML="";
 $("#admin-login").onsubmit=e=>{e.preventDefault();if(new FormData(e.target).get("password")!==settings.adminPassword){toast("Senha inválida.");return}modalRoot.innerHTML="";onSuccess()};
}
function showSettings(){askAdmin(()=>renderSettings())}
function renderSettings(){
 app.innerHTML=`<section class="screen"><div class="section-header"><div><span class="eyebrow">Administração local</span><h1>Configurações</h1><p>Senha inicial: 1234. Altere antes do uso comercial.</p></div></div>
 <form id="settings-form"><div class="card"><h2>Empresa e segurança</h2><div class="grid grid-2">${field("Nome da empresa","companyName",settings.company.name)}${field("Telefone","companyPhone",settings.company.phone)}${field("WhatsApp","companyWhatsapp",settings.company.whatsapp)}${field("E-mail","companyEmail",settings.company.email,"email")}${field("Nova senha administrativa","adminPassword",settings.adminPassword,"password")}</div></div>
 <div class="card"><h2>Parâmetros financeiros</h2><div class="grid grid-4">${field("Reserva técnica (%)","reservePercent",settings.finance.reservePercent,"number",'step="0.01"')}${field("Comissão (%)","commissionPercent",settings.finance.commissionPercent,"number",'step="0.01"')}${field("Implantação Plano 12 (%)","plan12ImplementationPercent",settings.finance.plan12ImplementationPercent,"number")}${field("Parcelas Plano 12","plan12Installments",settings.finance.plan12Installments,"number")}${field("Implantação Plano 24 (%)","plan24ImplementationPercent",settings.finance.plan24ImplementationPercent,"number")}${field("Parcelas Plano 24","plan24Installments",settings.finance.plan24Installments,"number")}</div></div>
 <div class="actions"><button type="button" class="button button--secondary" data-action="master-table">Tabela mestre</button><button class="button button--primary">Salvar configurações</button></div></form></section>`;
 $("#settings-form").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target).entries());settings.company={...settings.company,name:d.companyName,phone:d.companyPhone,whatsapp:d.companyWhatsapp,email:d.companyEmail};settings.adminPassword=d.adminPassword||settings.adminPassword;["reservePercent","commissionPercent","plan12ImplementationPercent","plan12Installments","plan24ImplementationPercent","plan24Installments"].forEach(k=>settings.finance[k]=Number(d[k]));await put(STORES.settings,settings);toast("Configurações salvas.")};
 $("[data-action='master-table']").onclick=renderMaster;
}
function renderMaster(){
 app.innerHTML=`<section class="screen"><div class="section-header"><div><span class="eyebrow">Tabela mestre</span><h1>Preços e modalidades</h1></div><button class="button button--primary" data-action="add-master">Adicionar registro</button></div><div class="table-wrap"><table><thead><tr><th>Família</th><th>Característica</th><th>Material</th><th>Modalidade</th><th>Comercial</th><th>Custo</th><th>Mercado</th><th></th></tr></thead><tbody>${master.map(r=>`<tr><td>${esc(r.family)}</td><td>${esc(r.characteristic)}</td><td>${esc(r.material)}</td><td>${esc(r.modality)}</td><td>${money(r.commercialValue)}</td><td>${money(r.internalCost)}</td><td>${money(r.marketValue)}</td><td><button class="button button--ghost" data-edit-master="${r.id}">Editar</button></td></tr>`).join("")}</tbody></table></div></section>`;
 $("[data-action='add-master']").onclick=()=>openMasterModal();$$("[data-edit-master]").forEach(b=>b.onclick=()=>openMasterModal(master.find(r=>r.id===b.dataset.editMaster)));
}
function openMasterModal(row=null){
 const r=row||{id:uid(),family:"Espreguiçadeira",characteristic:"Outro",material:"Outro",modality:"Reforma",commercialValue:0,internalCost:0,marketValue:0,materialPercent:0,estimatedDays:30,active:true,modalityActive:true,strategy:"Preservação"};
 modalRoot.innerHTML=`<div class="modal-backdrop" data-close></div><section class="modal"><header class="modal__header"><h2>Registro da tabela mestre</h2><button class="icon-button icon-button--ghost" data-close>×</button></header><form id="master-form"><div class="modal__body"><div class="grid grid-2">${field("Família","family",r.family)}${field("Característica","characteristic",r.characteristic)}${field("Material","material",r.material)}${select("Modalidade","modality",r.modality,["Reforma","Troca","Venda nova"])}${field("Valor comercial","commercialValue",r.commercialValue,"number",'step="0.01"')}${field("Custo interno","internalCost",r.internalCost,"number",'step="0.01"')}${field("Preço médio de mercado","marketValue",r.marketValue,"number",'step="0.01"')}${field("Percentual do material","materialPercent",r.materialPercent,"number",'step="0.01"')}${field("Tempo estimado em dias","estimatedDays",r.estimatedDays,"number")}${field("Estratégia padrão","strategy",r.strategy)}</div></div><footer class="modal__footer"><button type="button" class="button button--ghost" data-close>Cancelar</button><button class="button button--primary">Salvar</button></footer></form></section>`;
 $$("[data-close]",modalRoot).forEach(x=>x.onclick=()=>modalRoot.innerHTML="");
 $("#master-form").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target).entries());Object.assign(r,d,{commercialValue:Number(d.commercialValue),internalCost:Number(d.internalCost),marketValue:Number(d.marketValue),materialPercent:Number(d.materialPercent),estimatedDays:Number(d.estimatedDays),active:true,modalityActive:true});await put(STORES.master,r);master=await getAll(STORES.master);modalRoot.innerHTML="";renderMaster()};
}
async function exportAll(){
 const data=await exportDatabase();download(`programa-ap-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2));toast("Backup JSON exportado.");
 const rows=await getAll(STORES.consultations);
 const csv=["Condomínio,CNPJ,Responsável,Data da consultoria,Score,Valor do patrimônio,Valor recomendado,Plano escolhido,Situação comercial"];
 for(const c of rows){const f=calculateConsultation(c,master,settings),d=weightedScore(c.areas.flatMap(a=>a.sets||[]));csv.push([c.condominium?.name,c.condominium?.cnpj,c.condominium?.decisionMaker,new Date(c.date).toLocaleDateString("pt-BR"),d.score.toFixed(1),f.market,f.presentedTotal,c.selectedPlan,c.decision?.status].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","))}
 download(`programa-ap-resumo-${new Date().toISOString().slice(0,10)}.csv`,csv.join("\n"),"text/csv;charset=utf-8");
}
function importAll(){fileInput.value="";fileInput.click()}
fileInput.onchange=async()=>{try{const data=JSON.parse(await fileInput.files[0].text());await importDatabase(data);settings=await get(STORES.settings,"app");master=await getAll(STORES.master);toast("Backup importado sem perda dos registros existentes.");showHome()}catch(e){toast(e.message||"Falha na importação.")}};
document.addEventListener("click",async e=>{
 const a=e.target.closest("[data-action]")?.dataset.action;if(!a)return;
 if(a==="new-consultation"){current=blankConsultation();await saveCurrent();showConsultation()}
 if(a==="open-consultations")showConsultations();
 if(a==="open-settings")showSettings();
 if(a==="export-data")exportAll();
 if(a==="import-data")importAll();
 if(a==="return-home"){collectVisibleForm();await saveCurrent();showHome()}
 if(a==="save-consultation"){collectVisibleForm();saveCurrent(true)}
 if(a==="navigate-back"){if(current){collectVisibleForm();saveCurrent();showHome()}else showHome()}
});
addEventListener("ap-print",exportPresentationPDF);
addEventListener("ap-decision",()=>{document.querySelector("#presentation-root")?.remove();currentStep="decision";renderStep()});
init().catch(e=>{console.error(e);app.innerHTML=`<section class="screen"><div class="card"><h1>Falha ao iniciar</h1><p>${esc(e.message)}</p></div></section>`});
