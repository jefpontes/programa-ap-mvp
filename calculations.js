
export const CONDITION_LABELS={5:"Excelente",4:"Bom",3:"Regular",2:"Ruim",1:"Crítico"};

export function weightedScore(sets=[]){
  let total=0,weighted=0,intervention=0;
  for(const set of sets){
    const qty=Number(set.quantity)||0;
    total+=qty;
    if(set.conditionMode==="lots"){
      for(const lot of set.conditionLots||[]){
        const q=Number(lot.quantity)||0,c=Number(lot.condition)||0;
        weighted+=q*c;
        if(c<=3) intervention+=q;
      }
    }else{
      const c=Number(set.condition)||0;
      weighted+=qty*c;
      if(c<=3) intervention+=qty;
    }
  }
  return {score:total?weighted/total:0,totalPieces:total,interventionPieces:intervention,
    interventionPercent:total?(intervention/total)*100:0};
}
export function scoreLabel(score){
  if(score>=4.5)return"Excelente";
  if(score>=3.5)return"Bom";
  if(score>=2.5)return"Regular";
  if(score>=1.5)return"Ruim";
  return score>0?"Crítico":"Não avaliado";
}
export function areaScore(area){return weightedScore(area.sets||[])}

export function chooseMasterRow(set,master,modality){
  const exact=master.find(r=>r.active&&r.modalityActive&&r.family===set.family&&r.modality===modality&&
    (r.characteristic===set.characteristic||r.characteristic==="Outro")&&
    (r.material===set.material||r.material==="Outro"));
  return exact||master.find(r=>r.active&&r.modalityActive&&r.family===set.family&&r.modality===modality) || null;
}
export function recommendedModality(set,consultation){
  if(set.family==="Ombrelone") return "Troca";
  if(set.family==="Estofado") return "Venda nova";
  if(set.isExpansion) return "Venda nova";
  if(consultation?.briefing?.modernizationInterest && Number(set.condition)<=2) return "Troca";
  return "Reforma";
}
export function calculateSet(set,master,consultation){
  const modality=set.modality||recommendedModality(set,consultation);
  const row=chooseMasterRow(set,master,modality);
  if(!row)return{modality,missingPrice:true,commercial:0,internal:0,market:0,quantity:Number(set.quantity)||0};
  const qty=Number(set.quantity)||0;
  const factor=1+(Number(row.materialPercent)||0)/100;
  return{
    modality,rowId:row.id,missingPrice:false,quantity:qty,
    commercial:Number(row.commercialValue)*factor*qty,
    internal:Number(row.internalCost)*factor*qty,
    market:Number(row.marketValue)*qty,
    unitCommercial:Number(row.commercialValue)*factor
  };
}
export function calculateConsultation(consultation,master,settings){
  const details=[]; let commercial=0,internal=0,market=0;
  for(const area of consultation.areas||[]){
    let areaCommercial=0,areaMarket=0,areaInternal=0;
    for(const set of area.sets||[]){
      const line=calculateSet(set,master,consultation);
      details.push({...line,areaId:area.id,areaName:area.name,setId:set.id,family:set.family});
      areaCommercial+=line.commercial;areaInternal+=line.internal;areaMarket+=line.market;
    }
    area.financial={commercial:areaCommercial,internal:areaInternal,market:areaMarket};
    commercial+=areaCommercial;internal+=areaInternal;market+=areaMarket;
  }
  const f=settings.finance||{};
  const reserve=internal*(Number(f.reservePercent)||0)/100;
  const commission=commercial*(Number(f.commissionPercent)||0)/100;
  const margin=commercial-internal-reserve-commission;
  const adjustment=Number(consultation.manualAdjustment?.adjustedValue);
  const presentedTotal=Number.isFinite(adjustment)&&adjustment>0?adjustment:commercial;
  const p12=plan(presentedTotal,Number(f.plan12ImplementationPercent)||30,Number(f.plan12Installments)||12,Number(f.plan12ExecutionMonths)||6);
  const p24=plan(presentedTotal,Number(f.plan24ImplementationPercent)||20,Number(f.plan24Installments)||23,Number(f.plan24ExecutionMonths)||12);
  return{details,commercial,presentedTotal,internal,market,reserve,commission,margin,
    economy:Math.max(0,market-presentedTotal),plan12:p12,plan24:p24};
}
function plan(total,percent,installments,executionMonths){
  const implementation=total*percent/100,balance=total-implementation;
  return{total,percent,implementation,balance,installments,installmentValue:installments?balance/installments:0,executionMonths};
}
export function priorityValue(area,consultation){
  let v=0;
  if(area.requestedPriority)v+=100;
  const s=areaScore(area).score;if(s>0)v+=(5-s)*15;
  const visible=["Piscina","Área gourmet","Lounge","Rooftop","Solário"].includes(area.name);if(visible)v+=15;
  const use={Alto:15,Médio:8,Baixo:2}[consultation.briefing?.usageLevel]||0;
  return v+use;
}
export function buildSchedule(consultation){
  const months=consultation.selectedPlan==="24"?12:6;
  const sorted=[...(consultation.areas||[])].sort((a,b)=>priorityValue(b,consultation)-priorityValue(a,consultation));
  return sorted.map((area,i)=>({areaId:area.id,name:area.name,phase:i+1,
    period:i===0?"Primeiros 30 dias":`Mês ${Math.min(months,Math.max(2,Math.ceil((i+1)*months/Math.max(1,sorted.length))))}`}));
}
export function validateLots(set){
  if(set.conditionMode!=="lots")return Number(set.condition)>=1;
  const sum=(set.conditionLots||[]).reduce((a,l)=>a+(Number(l.quantity)||0),0);
  return sum===Number(set.quantity)&&(set.conditionLots||[]).every(l=>Number(l.condition)>=1&&Number(l.quantity)>0);
}
export const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
