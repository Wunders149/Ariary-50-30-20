const STORAGE_KEY = "budget5020.pwa.v1";
const DEFAULT = {income:450000,goalTarget:1080000,goalSaved:0,transactions:[],goalContributions:[]};
let state = loadState();
let selectedMonth = new Date().toISOString().slice(0,7);
let deferredInstallPrompt = null;
const $ = id => document.getElementById(id);
const money = value => `${Math.round(value||0).toLocaleString("fr-FR")} Ar`;
const monthName = key => {const [y,m]=key.split("-").map(Number);return new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"}).format(new Date(y,m-1,1));};
function loadState(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")};}catch{return {...DEFAULT};}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function monthTransactions(){return state.transactions.filter(t=>t.date.slice(0,7)===selectedMonth);}
function sums(items){return {needs:items.filter(t=>t.category==="needs").reduce((s,t)=>s+t.amount,0),wants:items.filter(t=>t.category==="wants").reduce((s,t)=>s+t.amount,0),savings:items.filter(t=>t.category==="savings").reduce((s,t)=>s+t.amount,0)};}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);}
function render(){
  const income=Number(state.income)||0, targets={needs:income*.5,wants:income*.3,savings:income*.2};
  const tx=monthTransactions(), spent=sums(tx), total=tx.reduce((s,t)=>s+t.amount,0);
  $("incomeDisplay").textContent=money(income);$("spentDisplay").textContent=money(total);
  $("spentPercent").textContent=`${income?Math.round(total/income*100):0} % du revenu`;
  $("balanceDisplay").textContent=money(income-total);$("balanceDisplay").style.color=income-total<0?"#c14e4e":"";
  $("needsTarget").textContent=money(targets.needs);$("wantsTarget").textContent=money(targets.wants);$("savingsTarget").textContent=money(targets.savings);
  const names={needs:"Besoins essentiels",wants:"Envies et loisirs",savings:"Épargne"};
  const colors={needs:"var(--needs)",wants:"var(--wants)",savings:"var(--savings)"};
  $("envelopes").innerHTML=Object.keys(targets).map(k=>{const pct=targets[k]?Math.min(100,spent[k]/targets[k]*100):0;const diff=targets[k]-spent[k];return `<article class="envelope"><div class="envelope-head"><span>${names[k]}</span><strong>${k==="needs"?"50":k==="wants"?"30":"20"} %</strong></div><div class="target">${money(targets[k])}</div><div class="sub">Réalisé : ${money(spent[k])}</div><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${colors[k]}"></div></div><div class="envelope-foot"><span>${diff>=0?"Reste":"Dépassement"}</span><b>${money(Math.abs(diff))}</b></div></article>`;}).join("");
  const labels={needs:"Besoin",wants:"Envie",savings:"Épargne"};
  const sorted=[...tx].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  $("transactionList").innerHTML=sorted.length?sorted.map(t=>`<div class="transaction"><div class="transaction-main"><strong>${escapeHtml(t.description)}</strong><small>${formatDate(t.date)} · ${labels[t.category]}</small></div><div class="transaction-right"><strong>${money(t.amount)}</strong><button class="delete-btn" data-delete="${t.id}" aria-label="Supprimer">×</button></div></div>`).join(""):`<div class="empty">Aucune opération enregistrée pour ${monthName(selectedMonth)}.</div>`;
  renderGoal();renderHistory();
}
function renderGoal(){const target=Number(state.goalTarget)||0,saved=Number(state.goalSaved)||0,pct=target?Math.min(100,saved/target*100):0;$("goalTarget").textContent=money(target);$("goalSaved").textContent=money(saved);$("goalProgress").style.width=pct+"%";$("goalPercent").textContent=`${Math.round(pct)} % atteint`;$("goalRemaining").textContent=saved>=target?"Objectif atteint !":`Reste ${money(target-saved)}`;}
function renderHistory(){const months=new Set(state.transactions.map(t=>t.date.slice(0,7)));months.add(selectedMonth);const keys=[...months].sort().reverse();$("historyList").innerHTML=keys.map(key=>{const tx=state.transactions.filter(t=>t.date.slice(0,7)===key),s=sums(tx),total=tx.reduce((a,t)=>a+t.amount,0);return `<article class="history-item"><div><strong>${monthName(key)}</strong><small>${tx.length} opération(s)</small></div><div class="history-metric"><strong>${money(total)}</strong><small>Dépenses / mouvements</small></div><div class="history-metric"><strong>${money(s.needs)}</strong><small>Besoins</small></div><div class="history-metric"><strong>${money(s.wants+s.savings)}</strong><small>Envies + épargne</small></div></article>`;}).join("");}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function formatDate(s){return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(s+"T12:00:00"));}
$("monthPicker").value=selectedMonth;$("transactionDate").value=new Date().toISOString().slice(0,10);
$("monthPicker").addEventListener("change",e=>{selectedMonth=e.target.value||selectedMonth;render();});
$("editIncomeBtn").addEventListener("click",()=>{$("incomeInput").value=state.income;$("incomeDialog").showModal();});
$("incomeForm").addEventListener("submit",e=>{e.preventDefault();const v=Number($("incomeInput").value);if(!Number.isFinite(v)||v<0)return;state.income=v;saveState();$("incomeDialog").close();render();toast("Revenu mensuel mis à jour.");});
$("transactionForm").addEventListener("submit",e=>{e.preventDefault();const amount=Number($("amount").value),description=$("description").value.trim(),date=$("transactionDate").value;if(!description||!date||!Number.isFinite(amount)||amount<=0)return toast("Vérifie la description et le montant.");state.transactions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),description,amount,category:$("category").value,date,createdAt:Date.now()});saveState();$("transactionForm").reset();$("transactionDate").value=new Date().toISOString().slice(0,10);render();toast("Opération enregistrée sur cet appareil.");});
$("transactionList").addEventListener("click",e=>{const b=e.target.closest("[data-delete]");if(!b)return;if(confirm("Supprimer cette opération ?")){state.transactions=state.transactions.filter(t=>t.id!==b.dataset.delete);saveState();render();toast("Opération supprimée.");}});
$("goalForm").addEventListener("submit",e=>{e.preventDefault();const amount=Number($("goalContribution").value);if(!Number.isFinite(amount)||amount<=0)return toast("Saisis un montant valide.");state.goalSaved+=amount;state.goalContributions.push({amount,date:new Date().toISOString().slice(0,10)});saveState();$("goalForm").reset();renderGoal();toast("Contribution ajoutée à ton objectif ordinateur.");});
$("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`budget-50-30-20-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("Sauvegarde exportée.");});
$("importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(typeof data.income!=="number"||!Array.isArray(data.transactions))throw new Error();state={...DEFAULT,...data};saveState();render();toast("Sauvegarde restaurée.");}catch{toast("Fichier invalide ou incompatible.");}e.target.value="";});
$("clearMonthBtn").addEventListener("click",()=>{if(!confirm(`Supprimer toutes les opérations de ${monthName(selectedMonth)} ? Cette action est irréversible.`))return;state.transactions=state.transactions.filter(t=>t.date.slice(0,7)!==selectedMonth);saveState();render();toast("Opérations du mois supprimées.");});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installBtn").classList.remove("hidden");});
$("installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("installBtn").classList.add("hidden");});
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
render();