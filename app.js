const STORAGE_KEY = "budget5020.pwa.v1";
const DEFAULT = {
  income: 450000,
  goalTarget: 1080000,
  goalSaved: 0,
  transactions: [],
  goalContributions: []
};

let state = loadState();
let selectedMonth = new Date().toISOString().slice(0, 7);
let deferredInstallPrompt = null;

const $ = id => document.getElementById(id);

const money = value => `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} Ar`;

const monthName = key => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
};

const formatDate = s => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${s}T12:00:00`));

const makeId = () => {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...DEFAULT,
      ...saved,
      transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
      goalContributions: Array.isArray(saved.goalContributions) ? saved.goalContributions : []
    };
  } catch {
    return { ...DEFAULT };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function monthTransactions() {
  return state.transactions.filter(t => String(t.date || "").slice(0, 7) === selectedMonth);
}

function sums(items) {
  return {
    needs: items.filter(t => t.category === "needs").reduce((sum, t) => sum + Number(t.amount || 0), 0),
    wants: items.filter(t => t.category === "wants").reduce((sum, t) => sum + Number(t.amount || 0), 0),
    savings: items.filter(t => t.category === "savings").reduce((sum, t) => sum + Number(t.amount || 0), 0)
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function setDefaultDate() {
  const today = new Date().toISOString().slice(0, 10);
  $("transactionDate").value = today;
}

function renderBudgetSummary(tx, spent, income, targets) {
  const total = tx.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remaining = income - total;
  const spendPct = income ? Math.round((total / income) * 100) : 0;
  $("spentDisplay").textContent = money(total);
  $("spentPercent").textContent = `${spendPct} % du revenu`;
  $("balanceDisplay").textContent = money(remaining);
  $("balanceDisplay").style.color = remaining < 0 ? "#c14e4e" : "";
  $("remainingDisplay").textContent = money(remaining);
  $("budgetStatus").textContent = remaining < 0 ? "Dépassement" : "Budget stable";
  $("budgetHealth").textContent = remaining >= 0 ? "Très bien" : "À revoir";
  $("budgetInsight").textContent = remaining >= 0 ? `Reste ${money(remaining)}` : `Dépassement de ${money(Math.abs(remaining))}`;

  const topCategory = Object.entries(spent).sort((a, b) => b[1] - a[1])[0];
  const categoryNames = { needs: "Besoins", wants: "Envies", savings: "Épargne" };
  $("topCategory").textContent = topCategory && topCategory[1] > 0 ? categoryNames[topCategory[0]] : "Aucune dépense";
  $("savingsInsight").textContent = money(targets.savings);
}

function renderEnvelopeCards(spent, targets) {
  const names = { needs: "Besoins", wants: "Envies", savings: "Épargne" };
  const colors = { needs: "needs-fill", wants: "wants-fill", savings: "savings-fill" };

  $("envelopes").innerHTML = Object.keys(targets).map(key => {
    const target = Number(targets[key]) || 0;
    const used = Number(spent[key]) || 0;
    const pct = target ? Math.min(100, (used / target) * 100) : 0;
    const diff = target - used;
    const label = key === "needs" ? "50 %" : key === "wants" ? "30 %" : "20 %";

    return `
      <article class="envelope">
        <div class="envelope-head">
          <span>${names[key]}</span>
          <span class="target">${label}</span>
        </div>

        <div class="sub">Cible : ${money(target)}</div>

        <div class="progress-track">
          <div class="progress-fill ${colors[key]}" style="width:${pct}%"></div>
        </div>

        <div class="envelope-foot">
          <span>${diff >= 0 ? "Restant" : "Dépensé"}</span>
          <b>${money(Math.abs(diff))}</b>
        </div>
      </article>
    `;
  }).join("");
}

function renderTransactions() {
  const tx = monthTransactions();
  const sorted = [...tx].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const labels = { needs: "Besoin", wants: "Envie", savings: "Épargne" };

  $("transactionList").innerHTML = sorted.length
    ? sorted.map(item => `
      <div class="transaction">
        <div class="transaction-main">
          <strong>${escapeHtml(item.description)}</strong>
          <small>${formatDate(item.date)} · ${labels[item.category] || item.category}</small>
        </div>
        <div class="transaction-right">
          <strong>${money(item.amount)}</strong>
          <button class="delete-btn" type="button" data-delete="${item.id}" aria-label="Supprimer">×</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">Aucune opération enregistrée pour ${monthName(selectedMonth)}.</div>`;
}

function renderGoal() {
  const target = Number(state.goalTarget) || 0;
  const saved = Number(state.goalSaved) || 0;
  const pct = target ? Math.min(100, (saved / target) * 100) : 0;
  const remaining = Math.max(target - saved, 0);

  $("goalTarget").textContent = money(target);
  $("goalSaved").textContent = money(saved);
  $("goalProgress").style.width = `${pct}%`;
  $("goalPercent").textContent = `${Math.round(pct)} % atteint`;
  $("goalRemaining").textContent = remaining > 0 ? `Reste ${money(remaining)}` : "Objectif atteint !";
}

function renderHistory() {
  const months = new Set(state.transactions.map(t => String(t.date || "").slice(0, 7)));
  months.add(selectedMonth);
  const keys = [...months].sort().reverse();

  $("historyList").innerHTML = keys.map(key => {
    const tx = state.transactions.filter(t => String(t.date || "").slice(0, 7) === key);
    const totals = sums(tx);
    const total = tx.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return `
      <article class="history-item">
        <div>
          <strong>${monthName(key)}</strong>
          <small>${tx.length} opération${tx.length > 1 ? "s" : ""}</small>
        </div>
        <div class="history-metric">
          <strong>${money(total)}</strong>
          <small>Total</small>
        </div>
        <div class="history-metric">
          <strong>${money(totals.needs)}</strong>
          <small>Besoins</small>
        </div>
        <div class="history-metric">
          <strong>${money(totals.wants + totals.savings)}</strong>
          <small>Envies + épargne</small>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  const income = Number(state.income) || 0;
  const targets = {
    needs: income * 0.5,
    wants: income * 0.3,
    savings: income * 0.2
  };

  const tx = monthTransactions();
  const spent = sums(tx);
  renderBudgetSummary(tx, spent, income, targets);
  renderEnvelopeCards(spent, targets);
  renderTransactions();
  renderGoal();
  renderHistory();
}

$("monthPicker").value = selectedMonth;
$("transactionDate").value = new Date().toISOString().slice(0, 10);

$("monthPicker").addEventListener("change", e => {
  selectedMonth = e.target.value || selectedMonth;
  render();
});

$("editIncomeBtn").addEventListener("click", () => {
  $("incomeInput").value = state.income;
  $("incomeDialog").showModal();
});

$("incomeForm").addEventListener("submit", e => {
  e.preventDefault();
  const value = Number($("incomeInput").value);
  if (!Number.isFinite(value) || value < 0) return toast("Saisis un revenu valide.");
  state.income = value;
  saveState();
  $("incomeDialog").close();
  render();
  toast("Revenu mensuel mis à jour.");
});

$("transactionForm").addEventListener("submit", e => {
  e.preventDefault();

  const amount = Number($("amount").value);
  const description = $("description").value.trim();
  const category = $("category").value;
  const date = $("transactionDate").value;

  if (!description || !date || !Number.isFinite(amount) || amount <= 0) {
    return toast("Vérifie la description, la date et le montant.");
  }

  state.transactions.push({
    id: makeId(),
    description,
    amount,
    category,
    date,
    createdAt: Date.now()
  });

  saveState();
  $("transactionForm").reset();
  setDefaultDate();
  render();
  toast("Opération enregistrée sur ce mois.");
});

$("transactionList").addEventListener("click", e => {
  const button = e.target.closest("[data-delete]");
  if (!button) return;

  if (!confirm("Supprimer cette opération ?")) return;

  state.transactions = state.transactions.filter(t => t.id !== button.dataset.delete);
  saveState();
  render();
  toast("Opération supprimée.");
});

$("goalForm").addEventListener("submit", e => {
  e.preventDefault();

  const amount = Number($("goalContribution").value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return toast("Saisis un montant valide.");
  }

  state.goalSaved += amount;
  state.goalContributions.push({ amount, date: new Date().toISOString().slice(0, 10) });
  saveState();
  $("goalForm").reset();
  renderGoal();
  toast("Contribution ajoutée à l’objectif.");
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([
    JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
  ], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `budget-50-30-20-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Sauvegarde exportée.");
});

$("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (typeof data.income !== "number" || !Array.isArray(data.transactions)) {
      throw new Error("Invalid import");
    }

    state = {
      ...DEFAULT,
      ...data,
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      goalContributions: Array.isArray(data.goalContributions) ? data.goalContributions : []
    };
    saveState();
    render();
    toast("Sauvegarde restaurée.");
  } catch {
    toast("Fichier invalide ou incompatible.");
  } finally {
    e.target.value = "";
  }
});

$("clearMonthBtn").addEventListener("click", () => {
  const monthLabel = monthName(selectedMonth);
  if (!confirm(`Supprimer toutes les opérations de ${monthLabel} ? Cette action est irréversible.`)) return;

  state.transactions = state.transactions.filter(t => String(t.date || "").slice(0, 7) !== selectedMonth);
  saveState();
  render();
  toast("Opérations du mois supprimées.");
});

$("installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("installBtn").classList.add("hidden");
});

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $("installBtn").classList.remove("hidden");
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

document.querySelectorAll("[data-quick]").forEach(button => {
  button.addEventListener("click", () => {
    const input = $("amount");
    input.value = button.dataset.quick;
    input.focus();
  });
});

setDefaultDate();
render();

if (!$("installBtn").classList.contains("hidden") && !deferredInstallPrompt) {
  $("installBtn").classList.add("hidden");
}

