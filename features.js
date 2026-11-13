(function () {
  "use strict";
  const STORAGE_KEY = "budget5020.pwa.v1";
  const $ = id => document.getElementById(id);
  const keys = ["needs", "wants", "savings"];
  const labels = { needs: "Besoins", wants: "Envies", savings: "Épargne" };
  let editingId = null;
  let observerLock = false;

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...saved, transactions: Array.isArray(saved.transactions) ? saved.transactions : [], recurringRules: Array.isArray(saved.recurringRules) ? saved.recurringRules : [], categoryBudgets: saved.categoryBudgets && typeof saved.categoryBudgets === "object" ? saved.categoryBudgets : {} };
    } catch { return { transactions: [], recurringRules: [], categoryBudgets: {} }; }
  }

  function writeState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch { window.alert("Impossible d’enregistrer : l’espace de stockage du navigateur est peut-être plein."); return false; }
  }

  const pad = n => String(n).padStart(2, "0");
  const monthKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  const dateForMonth = (startDate, key) => {
    const [year, month] = key.split("-").map(Number);
    const originalDay = Number(startDate.slice(8, 10));
    const day = Math.min(originalDay, new Date(year, month, 0).getDate());
    return `${year}-${pad(month)}-${pad(day)}`;
  };
  const money = n => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} Ar`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function createOccurrences() {
    const state = readState();
    const today = new Date();
    const currentMonth = monthKey(today);
    let changed = false;
    state.recurringRules.forEach(rule => {
      if (!rule || !rule.id || !/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate || "")) return;
      let cursor = rule.startDate.slice(0, 7);
      while (cursor <= currentMonth) {
        const date = dateForMonth(rule.startDate, cursor);
        const exists = state.transactions.some(t => t.recurringId === rule.id && t.date === date);
        if (!exists) {
          state.transactions.push({ id: `rec-${rule.id}-${cursor}`, recurringId: rule.id, description: rule.description, amount: Number(rule.amount), category: rule.category, date, createdAt: Date.now() });
          changed = true;
        }
        const [year, month] = cursor.split("-").map(Number);
        cursor = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
      }
    });
    if (changed) writeState(state);
  }

  function selectedMonth() { return $("monthPicker")?.value || monthKey(new Date()); }

  function renderBudgets() {
    const state = readState();
    const month = selectedMonth();
    const totals = Object.fromEntries(keys.map(key => [key, state.transactions.filter(t => t.date?.slice(0, 7) === month && t.category === key).reduce((sum, t) => sum + Number(t.amount || 0), 0)]));
    keys.forEach(key => { const input = $("budget" + key[0].toUpperCase() + key.slice(1)); if (input && document.activeElement !== input) input.value = state.categoryBudgets[key] ?? ""; });
    $("categoryBudgetStatus").innerHTML = keys.map(key => {
      const limit = Number(state.categoryBudgets[key]);
      const spent = totals[key];
      if (!Number.isFinite(limit) || limit <= 0) return `<div class="budget-status"><span>${labels[key]}</span><strong>Plafond non défini</strong></div>`;
      const delta = limit - spent;
      return `<div class="budget-status ${delta < 0 ? "over-budget" : ""}"><span>${labels[key]}</span><strong>${delta >= 0 ? `Reste ${money(delta)}` : `Dépassé de ${money(Math.abs(delta))}`}</strong><small>${money(spent)} / ${money(limit)}</small><div class="budget-meter"><i style="width:${Math.min(100, spent / limit * 100)}%"></i></div></div>`;
    }).join("");
  }

  function renderTrends() {
    const host = $("trendChart");
    if (!host) return;
    const state = readState();
    const now = new Date();
    const months = [];
    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = monthKey(date);
      const sums = Object.fromEntries(keys.map(category => [category, state.transactions.filter(t => t.date?.slice(0, 7) === key && t.category === category).reduce((sum, t) => sum + Number(t.amount || 0), 0)]));
      months.push({ key, label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date), ...sums, total: keys.reduce((sum, k) => sum + sums[k], 0) });
    }
    const max = Math.max(1, ...months.map(m => m.total));
    const chart = months.map(m => {
      const height = Math.max(4, Math.round(m.total / max * 100));
      const needH = m.total ? m.needs / m.total * height : 0;
      const wantH = m.total ? m.wants / m.total * height : 0;
      const savingsH = m.total ? m.savings / m.total * height : 0;
      return `<div class="trend-column" title="${escapeHtml(m.label)} : ${money(m.total)}"><div class="trend-bar" style="height:${height}%"><i class="trend-needs" style="height:${needH}%"></i><i class="trend-wants" style="height:${wantH}%"></i><i class="trend-savings" style="height:${savingsH}%"></i></div><strong>${m.total ? money(m.total) : "—"}</strong><span>${escapeHtml(m.label)}</span></div>`;
    }).join("");
    host.innerHTML = `<div class="trend-legend"><span><i class="trend-needs"></i>Besoins</span><span><i class="trend-wants"></i>Envies</span><span><i class="trend-savings"></i>Épargne</span></div><div class="trend-bars">${chart}</div>`;
  }

  function refresh() { renderBudgets(); renderTrends(); }

  $("categoryBudgetForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const state = readState();
    const budget = {};
    for (const key of keys) {
      const raw = $("budget" + key[0].toUpperCase() + key.slice(1)).value;
      if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) { window.alert("Saisis des plafonds valides ou laisse un champ vide."); return; }
      if (raw !== "") budget[key] = Number(raw);
    }
    state.categoryBudgets = budget;
    if (writeState(state)) { refresh(); document.dispatchEvent(new CustomEvent("budget:datachanged")); }
  });

  $("transactionForm")?.addEventListener("submit", event => {
    const repeat = $("repeatMonthly");
    if (!editingId && !repeat?.checked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const description = $("description").value.trim();
    const amount = Number($("amount").value);
    const category = $("category").value;
    const date = $("transactionDate").value;
    if (!description || !date || !Number.isFinite(amount) || amount <= 0) return;

    const state = readState();
    if (editingId) {
      const index = state.transactions.findIndex(t => String(t.id) === String(editingId));
      if (index < 0) { editingId = null; window.alert("Cette opération n’existe plus."); return; }
      state.transactions[index] = { ...state.transactions[index], description, amount, category, date };
      // Changing a generated occurrence detaches it from the recurring template rather than changing past/future copies.
      if (state.transactions[index].recurringId && date !== state.transactions[index].date) delete state.transactions[index].recurringId;
      editingId = null;
    } else {
      const ruleId = repeat.checked ? `rule-${Date.now()}-${Math.random().toString(16).slice(2)}` : null;
      if (ruleId) state.recurringRules.push({ id: ruleId, description, amount, category, startDate: date });
      state.transactions.push({ id: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`, ...(ruleId ? { recurringId: ruleId } : {}), description, amount, category, date, createdAt: Date.now() });
    }
    if (!writeState(state)) return;
    $("transactionForm").reset();
    $("transactionDate").value = new Date().toISOString().slice(0, 10);
    $("repeatMonthly").checked = false;
    $("editNotice").hidden = true;
    $("transactionSubmit").textContent = "＋ Enregistrer l’opération";
    document.dispatchEvent(new CustomEvent("budget:datachanged"));
    // Run the existing renderer's event logic only for display without re-submitting the form.
    window.location.reload();
  }, true);

  function beginEdit(id) {
    const item = readState().transactions.find(t => String(t.id) === String(id));
    if (!item) return;
    editingId = item.id;
    $("description").value = item.description || "";
    $("amount").value = item.amount;
    $("category").value = item.category;
    $("transactionDate").value = item.date;
    $("repeatMonthly").checked = false;
    $("editNotice").hidden = false;
    $("transactionSubmit").textContent = "Enregistrer les modifications";
    $("transactionForm").scrollIntoView({ behavior: "smooth", block: "center" });
    $("description").focus();
  }

  function addEditButtons() {
    if (observerLock) return;
    observerLock = true;
    document.querySelectorAll("#transactionList .transaction").forEach(row => {
      const del = row.querySelector("[data-delete]");
      if (!del || row.querySelector("[data-edit]")) return;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit-btn";
      edit.dataset.edit = del.dataset.delete;
      edit.setAttribute("aria-label", "Modifier l’opération");
      edit.textContent = "Modifier";
      del.parentElement.insertBefore(edit, del);
    });
    observerLock = false;
  }

  $("transactionList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-edit]");
    if (button) beginEdit(button.dataset.edit);
  });

  $("cancelEdit")?.addEventListener("click", () => {
    editingId = null;
    $("transactionForm").reset();
    $("transactionDate").value = new Date().toISOString().slice(0, 10);
    $("editNotice").hidden = true;
    $("transactionSubmit").textContent = "＋ Enregistrer l’opération";
  });

  $("exportCsvBtn")?.addEventListener("click", () => {
    const state = readState();
    const transactions = state.transactions;
    if (!transactions.length) { window.alert("Aucune opération à exporter pour le moment."); return; }
    const cell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [["Date", "Description", "Catégorie", "Montant (Ar)", "Récurrente"], ...transactions.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(t => [t.date, t.description, labels[t.category] || t.category, t.amount, t.recurringId ? "Oui" : "Non"])];
    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `budget-50-30-20-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("transactionSearch")?.addEventListener("input", filterList);
  $("categoryFilter")?.addEventListener("change", filterList);
  function filterList() {
    const list = $("transactionList"); if (!list) return;
    const query = ($("transactionSearch")?.value || "").trim().toLocaleLowerCase("fr-FR');
  }

  // Keep the search/filter implementation independent of renderer timing.
  function applyFilters() {
    const list = $("transactionList"); if (!list) return;
    const query = ($("transactionSearch")?.value || "").trim().toLocaleLowerCase("fr-FR");
    const selected = $("categoryFilter")?.value || "all";
    const rows = [...list.querySelectorAll(".transaction")];
    let visible = 0;
    rows.forEach(row => {
      const text = row.textContent.toLocaleLowerCase("fr-FR");
      const categoryText = row.querySelector(".transaction-main small")?.textContent.toLocaleLowerCase("fr-FR") || "";
      const matchCategory = selected === "all" || (selected === "needs" && categoryText.includes("besoin")) || (selected === "wants" && categoryText.includes("envie")) || (selected === "savings" && categoryText.includes("épargne"));
      row.hidden = !(matchCategory && (!query || text.includes(query)));
      if (!row.hidden) visible++;
    });
    let empty = list.querySelector(".filter-empty");
    if (rows.length && visible === 0) { if (!empty) { empty = document.createElement("div"); empty.className = "empty-state filter-empty"; empty.textContent = "Aucune opération ne correspond à ces filtres."; list.append(empty); } empty.hidden = false; }
    else if (empty) empty.hidden = true;
    const count = $("transactionCount"); if (count) count.textContent = `${visible} opération${visible === 1 ? "" : "s"}${visible !== rows.length ? ` sur ${rows.length}` : ""}`;
  }

  const listObserver = new MutationObserver(() => { addEditButtons(); applyFilters(); refresh(); });
  if ($("transactionList")) listObserver.observe($("transactionList"), { childList: true, subtree: true });
  const picker = $("monthPicker");
  picker?.addEventListener("change", () => { createOccurrences(); setTimeout(refresh, 0); });
  document.addEventListener("budget:datachanged", refresh);
  window.addEventListener("storage", event => { if (event.key === STORAGE_KEY) { createOccurrences(); refresh(); } });

  createOccurrences();
  refresh();
  addEditButtons();
  applyFilters();
})();
