/* ==============================
   Expense Tracker — app.js
   All app logic, localStorage, chart
============================== */

// ─── State ────────────────────────────────────────────────
let transactions = [];          // Array of transaction objects
let currentType  = 'income';    // 'income' | 'expense'
let chartInstance = null;       // Chart.js instance reference

// ─── Category config ──────────────────────────────────────
const CATEGORIES = {
  Food:          { emoji: '🍔', class: 'cat-food',          color: '#f4a56a' },
  Transport:     { emoji: '🚗', class: 'cat-transport',     color: '#7ec9e8' },
  Shopping:      { emoji: '🛍️', class: 'cat-shopping',     color: '#c97ef8' },
  Bills:         { emoji: '💡', class: 'cat-bills',         color: '#e8705c' },
  Entertainment: { emoji: '🎬', class: 'cat-entertainment', color: '#5cb87a' },
  Other:         { emoji: '📦', class: 'cat-other',         color: '#aaaaaa' },
};

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  setDefaultDate();
  updateHeaderMonth();
  populateMonthFilter();
  renderAll();

  // Form submit handler
  document.getElementById('transactionForm').addEventListener('submit', handleFormSubmit);
});

// ─── LocalStorage helpers ──────────────────────────────────

/** Persist transactions array to localStorage */
function saveToStorage() {
  localStorage.setItem('ledger_transactions', JSON.stringify(transactions));
}

/** Load transactions from localStorage on start */
function loadFromStorage() {
  const raw = localStorage.getItem('ledger_transactions');
  transactions = raw ? JSON.parse(raw) : [];
}

// ─── Date helpers ──────────────────────────────────────────

/** Set date input to today by default */
function setDefaultDate() {
  document.getElementById('txDate').value = todayISO();
}

/** Returns today as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Format ISO date string to readable e.g. "Feb 14, 2025" */
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

/** Returns "YYYY-MM" label from ISO date */
function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

/** Returns human-readable month label e.g. "February 2025" */
function monthLabel(key) {
  const [y, m] = key.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[+m - 1]} ${y}`;
}

/** Update header with current month name */
function updateHeaderMonth() {
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('currentMonth').textContent =
    `${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ─── Type toggle ───────────────────────────────────────────

/** Switch between income / expense form modes */
function switchType(type) {
  currentType = type;

  document.getElementById('btnIncome').classList.toggle('active', type === 'income');
  document.getElementById('btnExpense').classList.toggle('active', type === 'expense');

  document.getElementById('incomeFields').classList.toggle('hidden', type !== 'income');
  document.getElementById('expenseFields').classList.toggle('hidden', type !== 'expense');
}

// ─── Form handling ─────────────────────────────────────────

/** Handle form submission — validate, create transaction, save */
function handleFormSubmit(e) {
  e.preventDefault();

  const amount = parseFloat(document.getElementById('amount').value);
  const date   = document.getElementById('txDate').value;

  // Validate amount
  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount.');
    return;
  }

  // Validate date
  if (!date) {
    showToast('Please select a date.');
    return;
  }

  let transaction;

  if (currentType === 'income') {
    const desc = document.getElementById('incomeDesc').value.trim();
    if (!desc) { showToast('Please add a description.'); return; }

    transaction = {
      id:          Date.now(),
      type:        'income',
      description: desc,
      amount,
      date,
    };

    document.getElementById('incomeDesc').value = '';

  } else {
    const name     = document.getElementById('expenseName').value.trim();
    const category = document.getElementById('expenseCategory').value;

    if (!name)     { showToast('Please enter an expense name.'); return; }
    if (!category) { showToast('Please select a category.'); return; }

    transaction = {
      id:       Date.now(),
      type:     'expense',
      name,
      category,
      amount,
      date,
    };

    document.getElementById('expenseName').value  = '';
    document.getElementById('expenseCategory').value = '';
  }

  // Reset shared fields
  document.getElementById('amount').value  = '';
  document.getElementById('txDate').value  = todayISO();

  // Save and re-render
  transactions.push(transaction);
  saveToStorage();
  populateMonthFilter();
  renderAll();

  showToast(currentType === 'income' ? '✓ Income added!' : '✓ Expense recorded!');
}

// ─── Delete ────────────────────────────────────────────────

/** Delete a transaction by id */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  renderAll();
  showToast('Transaction removed.');
}

/** Confirm then wipe all transactions */
function confirmClearAll() {
  if (transactions.length === 0) { showToast('Nothing to clear.'); return; }
  if (confirm('Clear ALL transactions? This cannot be undone.')) {
    transactions = [];
    saveToStorage();
    renderAll();
    showToast('All transactions cleared.');
  }
}

// ─── Render pipeline ───────────────────────────────────────

/** Master render: summaries + list + chart */
function renderAll() {
  renderSummary();
  renderTransactions();
  renderChart();
}

// ─── Summary cards ─────────────────────────────────────────

/** Calculate and update the three summary cards */
function renderSummary() {
  const totalIncome  = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = totalIncome - totalExpense;

  document.getElementById('incomeAmount').textContent  = fmt(totalIncome);
  document.getElementById('expenseAmount').textContent = fmt(totalExpense);
  document.getElementById('balanceAmount').textContent = fmt(balance);

  // Color balance card amount based on positive / negative
  const el = document.getElementById('balanceAmount');
  el.style.color = balance >= 0 ? 'var(--text)' : 'var(--expense)';
}

// ─── Transaction list ──────────────────────────────────────

/** Populate month filter dropdown from existing transaction dates */
function populateMonthFilter() {
  const select = document.getElementById('filterMonth');
  const currentVal = select.value;

  // Collect unique month keys
  const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();

  // Rebuild options (keep "All Time")
  select.innerHTML = '<option value="all">All Time</option>';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = monthLabel(m);
    select.appendChild(opt);
  });

  // Restore selection if still valid
  if (currentVal && [...select.options].some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

/** Render filtered transaction list */
function renderTransactions() {
  const list      = document.getElementById('transactionList');
  const empty     = document.getElementById('emptyState');
  const filterVal = document.getElementById('filterMonth').value;

  // Filter transactions
  const filtered = filterVal === 'all'
    ? [...transactions]
    : transactions.filter(t => monthKey(t.date) === filterVal);

  // Sort newest first
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  // Clear existing items (keep empty state div)
  list.querySelectorAll('.tx-item').forEach(el => el.remove());

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  filtered.forEach(t => {
    list.appendChild(createTxElement(t));
  });
}

/** Build a transaction list item DOM element */
function createTxElement(t) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  div.dataset.id = t.id;

  const isIncome = t.type === 'income';

  // Icon box
  let iconClass, emoji;
  if (isIncome) {
    iconClass = 'cat-income';
    emoji     = '💰';
  } else {
    const cat = CATEGORIES[t.category] || CATEGORIES['Other'];
    iconClass = cat.class;
    emoji     = cat.emoji;
  }

  const label    = isIncome ? t.description : t.name;
  const subLabel = isIncome ? 'Income' : t.category;
  const sign     = isIncome ? '+' : '−';
  const amtClass = isIncome ? 'income' : 'expense';

  div.innerHTML = `
    <div class="tx-icon ${iconClass}">${emoji}</div>
    <div class="tx-info">
      <div class="tx-name">${escHtml(label)}</div>
      <div class="tx-meta">${subLabel} · ${formatDate(t.date)}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amount ${amtClass}">${sign}${fmt(t.amount)}</div>
      <button class="tx-delete" title="Delete" onclick="deleteTransaction(${t.id})">✕</button>
    </div>
  `;

  return div;
}

// ─── Chart ─────────────────────────────────────────────────

/** Render pie chart showing this month's expense distribution */
function renderChart() {
  const canvas    = document.getElementById('expenseChart');
  const legendDiv = document.getElementById('chartLegend');
  const noMsg     = document.getElementById('noChartMsg');
  const badge     = document.getElementById('chartMonth');

  // Use current month for chart data
  const now  = new Date();
  const key  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  badge.textContent = monthLabel(key);

  // Aggregate expenses by category for current month
  const totals = {};
  transactions
    .filter(t => t.type === 'expense' && monthKey(t.date) === key)
    .forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

  const categories = Object.keys(totals);
  const total      = Object.values(totals).reduce((s, v) => s + v, 0);

  // Hide / show chart elements
  if (categories.length === 0) {
    canvas.style.display   = 'none';
    legendDiv.style.display = 'none';
    noMsg.style.display    = 'block';

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  canvas.style.display    = 'block';
  legendDiv.style.display = 'flex';
  noMsg.style.display     = 'none';

  // Build chart data arrays
  const labels  = categories;
  const data    = categories.map(c => totals[c]);
  const colors  = categories.map(c => (CATEGORIES[c] || CATEGORIES['Other']).color);

  // Destroy old chart before creating new one
  if (chartInstance) { chartInstance.destroy(); }

  chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor:  colors,
        borderColor:       '#17171e',
        borderWidth:       3,
        hoverBorderWidth:  4,
        hoverOffset:       8,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      cutout:              '60%',
      plugins: {
        legend: { display: false },        // We build our own legend
        tooltip: {
          callbacks: {
            label(ctx) {
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmt(ctx.parsed)} (${pct}%)`;
            }
          },
          backgroundColor: '#1f1f29',
          titleColor:       '#f0ede6',
          bodyColor:        '#aaaaaa',
          borderColor:      '#2a2a38',
          borderWidth:      1,
          padding:          10,
          displayColors:    false,
        }
      }
    }
  });

  // Build custom legend with percentages
  legendDiv.innerHTML = '';
  categories.forEach(cat => {
    const pct   = ((totals[cat] / total) * 100).toFixed(1);
    const color = (CATEGORIES[cat] || CATEGORIES['Other']).color;

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      ${cat} <strong style="color:var(--text)">${pct}%</strong>
    `;
    legendDiv.appendChild(item);
  });
}

// ─── Utilities ─────────────────────────────────────────────

/** Format number as Indian Rupee currency string */
function fmt(num) {
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Escape HTML special characters to prevent XSS */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Toast notifications ───────────────────────────────────

let toastTimer;

/** Show a brief notification toast */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
