(function () {
  const STORAGE_KEY = "budget5020.pwa.v1";
  const search = document.getElementById("transactionSearch");
  const category = document.getElementById("categoryFilter");
  const list = document.getElementById("transactionList");
  const count = document.getElementById("transactionCount");
  const csvButton = document.getElementById("exportCsvBtn");
  if (!search || !category || !list || !count || !csvButton) return;

  function filterTransactions() {
    const query = search.value.trim().toLocaleLowerCase("fr-FR");
    const selectedCategory = category.value;
    const rows = [...list.querySelectorAll(".transaction")];
    let visible = 0;

    rows.forEach(row => {
      const text = row.textContent.toLocaleLowerCase("fr-FR");
      const categoryText = row.querySelector(".transaction-main small")?.textContent.toLocaleLowerCase("fr-FR") || "";
      const matchesCategory = selectedCategory === "all" ||
        (selectedCategory === "needs" && categoryText.includes("besoin")) ||
        (selectedCategory === "wants" && categoryText.includes("envie")) ||
        (selectedCategory === "savings" && categoryText.includes("épargne"));
      const matchesQuery = !query || text.includes(query);
      row.hidden = !(matchesCategory && matchesQuery);
      if (!row.hidden) visible += 1;
    });

    const emptyState = list.querySelector(".empty-state");
    let noResults = list.querySelector(".filter-empty");
    if (rows.length && visible === 0) {
      if (!noResults) {
        noResults = document.createElement("div");
        noResults.className = "empty-state filter-empty";
        noResults.textContent = "Aucune opération ne correspond à ces filtres.";
        list.append(noResults);
      }
      noResults.hidden = false;
    } else if (noResults) {
      noResults.hidden = true;
    }

    if (emptyState) emptyState.hidden = false;
    count.textContent = `${visible} opération${visible === 1 ? "" : "s"}${rows.length !== visible ? ` sur ${rows.length}` : ""}`;
  }

  search.addEventListener("input", filterTransactions);
  category.addEventListener("change", filterTransactions);
  new MutationObserver(filterTransactions).observe(list, { childList: true, subtree: true });

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  csvButton.addEventListener("click", () => {
    let state;
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      window.alert("Impossible de lire les données enregistrées.");
      return;
    }

    const transactions = Array.isArray(state.transactions) ? state.transactions : [];
    if (!transactions.length) {
      window.alert("Aucune opération à exporter pour le moment.");
      return;
    }

    const labels = { needs: "Besoins", wants: "Envies", savings: "Épargne" };
    const lines = [["Date", "Description", "Catégorie", "Montant (Ar)"], ...transactions
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map(item => [item.date, item.description, labels[item.category] || item.category, item.amount])];
    const csv = "\uFEFF" + lines.map(line => line.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-50-30-20-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  filterTransactions();
})();
