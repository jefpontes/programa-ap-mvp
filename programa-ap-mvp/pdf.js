
export function exportPresentationPDF(){
  const active=[...document.querySelectorAll(".slide")].findIndex(x=>x.classList.contains("is-active"));
  document.body.dataset.previousSlide=String(active);
  window.print();
}
export function buildCommercialSummary(c,financial){
  const plan=c.selectedPlan==="24"?financial.plan24:financial.plan12;
  return `
    <section class="commercial-summary">
      <h1>Resumo Comercial de Contratação</h1>
      <p><strong>Condomínio:</strong> ${c.condominium?.name||""}</p>
      <p><strong>CNPJ:</strong> ${c.condominium?.cnpj||""}</p>
      <p><strong>Escopo aprovado:</strong> ${(c.decision?.approvedAreas||[]).join(", ")||"Programa completo"}</p>
      <p><strong>Modalidade:</strong> Plano ${c.selectedPlan||"12"}</p>
      <p><strong>Investimento inicial:</strong> ${plan.implementation.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
      <p><strong>Parcelas:</strong> ${plan.installments} × ${plan.installmentValue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
      <p><strong>Cronograma:</strong> execução em até ${plan.executionMonths} meses.</p>
      <p><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
      <br><br><p>__________________________________<br>Representante do condomínio</p>
      <br><p>__________________________________<br>Almeida Pontes</p>
    </section>`;
}
