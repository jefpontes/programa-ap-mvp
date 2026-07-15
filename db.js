
const DB_NAME = "ProgramaAPDB";
const DB_VERSION = 1;
const STORES = {
  consultations: "consultations",
  settings: "settings",
  master: "master",
  audit: "audit"
};

let dbPromise;

function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORES.consultations)){
        const s=db.createObjectStore(STORES.consultations,{keyPath:"id"});
        s.createIndex("status","status");
        s.createIndex("updatedAt","updatedAt");
      }
      if(!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings,{keyPath:"key"});
      if(!db.objectStoreNames.contains(STORES.master)){
        const s=db.createObjectStore(STORES.master,{keyPath:"id"});
        s.createIndex("family","family");
        s.createIndex("active","active");
      }
      if(!db.objectStoreNames.contains(STORES.audit)){
        const s=db.createObjectStore(STORES.audit,{keyPath:"id"});
        s.createIndex("createdAt","createdAt");
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return dbPromise;
}

async function tx(store,mode="readonly"){
  const db=await openDB();
  return db.transaction(store,mode).objectStore(store);
}
function requestToPromise(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function get(store,key){return requestToPromise((await tx(store)).get(key))}
export async function getAll(store){return requestToPromise((await tx(store)).getAll())}
export async function put(store,value){return requestToPromise((await tx(store,"readwrite")).put(value))}
export async function remove(store,key){return requestToPromise((await tx(store,"readwrite")).delete(key))}
export async function clear(store){return requestToPromise((await tx(store,"readwrite")).clear())}
export async function bulkPut(store,values){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(store,"readwrite");
    const s=t.objectStore(store);
    values.forEach(v=>s.put(v));
    t.oncomplete=()=>resolve();
    t.onerror=()=>reject(t.error);
  });
}
export async function exportDatabase(){
  const data={schemaVersion:1,exportedAt:new Date().toISOString(),stores:{}};
  for(const store of Object.values(STORES)) data.stores[store]=await getAll(store);
  return data;
}
export async function importDatabase(data){
  if(!data?.stores) throw new Error("Arquivo de backup inválido.");
  for(const store of Object.values(STORES)){
    if(Array.isArray(data.stores[store])) await bulkPut(store,data.stores[store]);
  }
}
export async function seedDatabase(){
  const settings=await get(STORES.settings,"app");
  if(!settings){
    await put(STORES.settings,{
      key:"app",adminPassword:"1234",version:"1.0.0",
      company:{name:"Almeida Pontes",phone:"",whatsapp:"",email:"",logoText:"AP"},
      finance:{
        reservePercent:5,commissionPercent:10,
        plan12ImplementationPercent:30,plan12Installments:12,plan12ExecutionMonths:6,
        plan24ImplementationPercent:20,plan24Installments:23,plan24ExecutionMonths:12,
        plan24ManagementPercent:0,renewalCreditPercent:0
      },
      families:[
        "Espreguiçadeira","Cadeira","Mesa","Mesa lateral","Poltrona","Sofá","Puff",
        "Banqueta","Chaise","Balanço","Banco","Ombrelone","Estofado","Outro"
      ].map(name=>({id:crypto.randomUUID(),name,active:true})),
      materials:[
        "Tela","Fibra sintética","Corda náutica","Tricô náutico","Alumínio pintado",
        "Aquablock","Couro náutico","Outro"
      ].map(name=>({id:crypto.randomUUID(),name,active:true})),
      characteristics:{
        "Espreguiçadeira":["Tubo","Dois furos","Três furos","Onda","Outro"],
        "Cadeira":["Empilhável","Com braço","Sem braço","Outro"],
        "Mesa":["Redonda","Quadrada","Retangular","Outro"],
        "Sofá":["2 lugares","3 lugares","Modular","Outro"],
        "Estofado":["1 lugar","2 lugares","3 lugares","4 lugares","Outro"],
        "Ombrelone":["Central","Lateral","Outro"]
      }
    });
  }
  const existing=await getAll(STORES.master);
  if(existing.length===0){
    const rows=[];
    const add=(family,characteristic,material,modality,commercial,internal,market,strategy="Preservação")=>rows.push({
      id:crypto.randomUUID(),family,characteristic,material,modality,
      commercialValue:commercial,internalCost:internal,marketValue:market,
      modalityActive:true,strategy,materialPercent:0,estimatedDays:30,active:true
    });
    add("Espreguiçadeira","Tubo","Tela","Reforma",480,220,950);
    add("Espreguiçadeira","Dois furos","Tela","Reforma",520,240,1050);
    add("Espreguiçadeira","Três furos","Tela","Reforma",560,260,1150);
    add("Espreguiçadeira","Onda","Tela","Reforma",620,290,1350);
    add("Espreguiçadeira","Tubo","Corda náutica","Troca",1650,950,2100,"Modernização");
    add("Cadeira","Com braço","Fibra sintética","Reforma",290,130,650);
    add("Cadeira","Sem braço","Corda náutica","Troca",690,390,890,"Modernização");
    add("Mesa","Redonda","Alumínio pintado","Reforma",780,360,1600);
    add("Poltrona","Outro","Corda náutica","Reforma",690,310,1400);
    add("Sofá","3 lugares","Corda náutica","Reforma",1850,850,3500);
    add("Puff","Outro","Corda náutica","Reforma",380,170,750);
    add("Ombrelone","Central","Outro","Troca",1850,1200,2400,"Substituição");
    add("Ombrelone","Central","Outro","Venda nova",2100,1350,2600,"Ampliação");
    add("Estofado","1 lugar","Aquablock","Venda nova",480,220,720,"Novo");
    await bulkPut(STORES.master,rows);
  }
}
export {STORES,openDB};
