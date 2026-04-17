/**
 * Pharmacy Management System — Frontend Logic
 * Uses fetch() to communicate with the FastAPI backend.
 * Stores login state in localStorage.
 */

// ---------- Configuration ----------
const API_BASE = ""; // Same origin — no prefix needed

// ---------- Auth Helpers ----------

/** Check if user is logged in; redirect to login page if not */
function requireAuth() {
    if (!localStorage.getItem("pharmacy_logged_in")) {
        window.location.href = "/";
    }
}

/** Save login state */
function setLoggedIn(username) {
    localStorage.setItem("pharmacy_logged_in", "true");
    localStorage.setItem("pharmacy_username", username);
}

/** Clear login state and redirect */
function logout() {
    localStorage.removeItem("pharmacy_logged_in");
    localStorage.removeItem("pharmacy_username");
    window.location.href = "/";
}

// ---------- Toast Notification System ----------

/** Show a toast notification */
function showToast(message, type = "success") {
    // Create container if it doesn't exist
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const icons = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || "ℹ️"}</span>
        <span class="toast-msg">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.add("removing");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ---------- API Helper ----------

/**
 * Make an API call with fetch().
 * Automatically handles JSON parsing and error display.
 */
async function apiCall(url, method = "GET", body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(API_BASE + url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Something went wrong");
        }

        return data;
    } catch (error) {
        showToast(error.message, "error");
        throw error;
    }
}


// =============================================
//  LOGIN PAGE
// =============================================

function initLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    // If already logged in, redirect to dashboard
    if (localStorage.getItem("pharmacy_logged_in")) {
        window.location.href = "/dashboard";
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        btn.textContent = "Signing in...";
        btn.disabled = true;

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        try {
            const data = await apiCall("/login", "POST", { username, password });
            setLoggedIn(data.username);
            showToast("Welcome back, " + data.username + "!");
            setTimeout(() => (window.location.href = "/dashboard"), 800);
        } catch {
            btn.textContent = "Sign In";
            btn.disabled = false;
        }
    });
}


// =============================================
//  DASHBOARD PAGE
// =============================================

async function initDashboard() {
    requireAuth();

    // Greet user
    const greetEl = document.getElementById("greetUser");
    if (greetEl) {
        const name = localStorage.getItem("pharmacy_username") || "Admin";
        greetEl.textContent = `Welcome back, ${name}`;
    }

    try {
        // Load stats
        const stats = await apiCall("/stats");
        animateCount("statTotal", stats.total_medicines);
        animateCount("statLowStock", stats.low_stock);
        animateCount("statExpiring", stats.expiring_soon);
        animateCount("statSales", stats.today_sales, true);

        // Load alerts
        const alerts = await apiCall("/alerts");
        renderAlerts(alerts);

        // Load recent sales
        const sales = await apiCall("/sales");
        renderRecentSales(sales.slice(0, 5));
    } catch (e) {
        console.error("Dashboard load error:", e);
    }
}

/** Animate counting up for stat cards */
function animateCount(elementId, targetValue, isCurrency = false) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 800;
    const start = performance.now();
    const startVal = 0;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out quad
        const eased = 1 - (1 - progress) * (1 - progress);
        const current = Math.round(startVal + (targetValue - startVal) * eased);

        el.textContent = isCurrency ? `₹${current.toLocaleString()}` : current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/** Render alert cards on dashboard */
function renderAlerts(alerts) {
    const container = document.getElementById("alertsList");
    if (!container) return;

    container.innerHTML = "";

    if (alerts.low_stock.length === 0 && alerts.expiring.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-icon">🎉</div>
                <p>No alerts — everything looks good!</p>
            </div>`;
        return;
    }

    alerts.low_stock.forEach((med) => {
        container.innerHTML += `
            <div class="alert-card alert-red">
                <div class="alert-icon">📦</div>
                <div class="alert-text">
                    <h4>${med.name}</h4>
                    <p>Low stock — only <strong>${med.quantity}</strong> left</p>
                </div>
            </div>`;
    });

    alerts.expiring.forEach((med) => {
        container.innerHTML += `
            <div class="alert-card alert-orange">
                <div class="alert-icon">⏰</div>
                <div class="alert-text">
                    <h4>${med.name}</h4>
                    <p>Expires on <strong>${med.expiry_date}</strong></p>
                </div>
            </div>`;
    });
}

/** Render recent sales table on dashboard */
function renderRecentSales(sales) {
    const tbody = document.getElementById("recentSalesBody");
    if (!tbody) return;

    if (sales.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="4" class="empty-state">
                <p class="text-muted">No sales recorded yet.</p>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = sales
        .map(
            (s) => `
        <tr>
            <td>${s.medicine_name}</td>
            <td>${s.quantity_sold}</td>
            <td class="text-green">₹${s.total_price.toFixed(2)}</td>
            <td class="text-muted">${s.sale_date}</td>
        </tr>`
        )
        .join("");
}


// =============================================
//  MEDICINES PAGE
// =============================================

async function initMedicines() {
    requireAuth();
    await loadMedicines();

    // Search functionality
    const searchInput = document.getElementById("searchMedicine");
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadMedicines(searchInput.value.trim());
            }, 300);
        });
    }
}

/** Fetch and render all medicines */
async function loadMedicines(search = "") {
    const tbody = document.getElementById("medicinesBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>`;

    try {
        const url = search ? `/medicines?search=${encodeURIComponent(search)}` : "/medicines";
        const medicines = await apiCall(url);

        if (medicines.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="empty-state">
                    <div class="empty-icon">💊</div>
                    <p>No medicines found.</p>
                </td></tr>`;
            return;
        }

        const today = new Date();
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        tbody.innerHTML = medicines
            .map((med) => {
                const expiry = new Date(med.expiry_date);
                let rowClass = "";
                let stockBadge = "";
                let expiryBadge = "";

                // Stock status
                if (med.quantity < 10) {
                    rowClass = "row-danger";
                    stockBadge = `<span class="badge badge-red">${med.quantity} — Low</span>`;
                } else {
                    stockBadge = `<span class="badge badge-green">${med.quantity}</span>`;
                }

                // Expiry status
                if (expiry <= today) {
                    rowClass = "row-danger";
                    expiryBadge = `<span class="badge badge-red">Expired</span>`;
                } else if (expiry <= thirtyDaysLater) {
                    if (!rowClass) rowClass = "row-warning";
                    expiryBadge = `<span class="badge badge-orange">Expiring Soon</span>`;
                } else {
                    expiryBadge = `<span class="badge badge-green">OK</span>`;
                }

                return `
                <tr class="${rowClass}">
                    <td>${med.medicine_id}</td>
                    <td><strong>${med.name}</strong></td>
                    <td>₹${med.price.toFixed(2)}</td>
                    <td>${stockBadge}</td>
                    <td>${med.expiry_date} ${expiryBadge}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-outline btn-sm" onclick="openEditModal(${med.medicine_id}, '${med.name.replace(/'/g, "\\'")}', ${med.price}, ${med.quantity}, '${med.expiry_date}')">✏️ Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteMedicine(${med.medicine_id}, '${med.name.replace(/'/g, "\\'")}')">🗑️</button>
                        </div>
                    </td>
                </tr>`;
            })
            .join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><p class="text-red">Failed to load medicines.</p></td></tr>`;
    }
}

/** Open edit modal with pre-filled data */
function openEditModal(id, name, price, quantity, expiry_date) {
    document.getElementById("editId").value = id;
    document.getElementById("editName").value = name;
    document.getElementById("editPrice").value = price;
    document.getElementById("editQuantity").value = quantity;
    document.getElementById("editExpiry").value = expiry_date;
    document.getElementById("editModal").classList.add("active");
}

function closeEditModal() {
    document.getElementById("editModal").classList.remove("active");
}

/** Submit edited medicine */
async function submitEdit() {
    const id = document.getElementById("editId").value;
    const body = {
        name: document.getElementById("editName").value.trim(),
        price: parseFloat(document.getElementById("editPrice").value),
        quantity: parseInt(document.getElementById("editQuantity").value),
        expiry_date: document.getElementById("editExpiry").value,
    };

    try {
        await apiCall(`/medicines/${id}`, "PUT", body);
        showToast("Medicine updated successfully!");
        closeEditModal();
        loadMedicines();
    } catch { /* error handled by apiCall */ }
}

/** Delete medicine with confirmation */
async function deleteMedicine(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
        await apiCall(`/medicines/${id}`, "DELETE");
        showToast("Medicine deleted.");
        loadMedicines();
    } catch { /* error handled by apiCall */ }
}


// =============================================
//  ADD MEDICINE PAGE
// =============================================

function initAddMedicine() {
    requireAuth();

    const form = document.getElementById("addMedicineForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.textContent = "Adding...";
        btn.disabled = true;

        const body = {
            name: document.getElementById("medName").value.trim(),
            price: parseFloat(document.getElementById("medPrice").value),
            quantity: parseInt(document.getElementById("medQuantity").value),
            expiry_date: document.getElementById("medExpiry").value,
        };

        try {
            await apiCall("/medicines", "POST", body);
            showToast("Medicine added successfully!");
            form.reset();
        } catch { /* error handled by apiCall */ }

        btn.textContent = "Add Medicine";
        btn.disabled = false;
    });
}


// =============================================
//  BILLING PAGE
// =============================================

async function initBilling() {
    requireAuth();

    // Populate medicine dropdown
    try {
        const medicines = await apiCall("/medicines");
        const select = document.getElementById("billingMedicine");
        if (select) {
            select.innerHTML = `<option value="">— Select Medicine —</option>`;
            medicines.forEach((med) => {
                select.innerHTML += `<option value="${med.medicine_id}" data-price="${med.price}" data-stock="${med.quantity}">${med.name} (Stock: ${med.quantity}) — ₹${med.price.toFixed(2)}</option>`;
            });
        }
    } catch {
        showToast("Failed to load medicines", "error");
    }

    // Auto-calculate total
    const select = document.getElementById("billingMedicine");
    const qtyInput = document.getElementById("billingQty");
    const totalDisplay = document.getElementById("billingTotal");

    function updateTotal() {
        const opt = select.options[select.selectedIndex];
        const price = parseFloat(opt?.dataset?.price || 0);
        const qty = parseInt(qtyInput?.value || 0);
        const total = price * qty;
        if (totalDisplay) totalDisplay.textContent = `₹${total.toFixed(2)}`;
    }

    if (select) select.addEventListener("change", updateTotal);
    if (qtyInput) qtyInput.addEventListener("input", updateTotal);

    // Handle sale form
    const form = document.getElementById("billingForm");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const medId = parseInt(select.value);
            const qty = parseInt(qtyInput.value);

            if (!medId) return showToast("Please select a medicine", "warning");
            if (!qty || qty <= 0) return showToast("Enter a valid quantity", "warning");

            // Check stock
            const opt = select.options[select.selectedIndex];
            const stock = parseInt(opt.dataset.stock);
            if (qty > stock) {
                return showToast(`Insufficient stock. Available: ${stock}`, "error");
            }

            const btn = form.querySelector("button[type='submit']");
            btn.textContent = "Processing...";
            btn.disabled = true;

            try {
                const result = await apiCall("/sales", "POST", {
                    medicine_id: medId,
                    quantity_sold: qty,
                });

                showToast("Sale completed! 🎉");

                // Show receipt
                showReceipt(result);

                form.reset();
                if (totalDisplay) totalDisplay.textContent = "₹0.00";

                // Refresh dropdown
                initBilling();
            } catch { /* handled */ }

            btn.textContent = "Complete Sale";
            btn.disabled = false;
        });
    }

    // Load recent sales
    try {
        const sales = await apiCall("/sales");
        const tbody = document.getElementById("salesHistoryBody");
        if (tbody) {
            if (sales.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><p class="text-muted">No sales yet.</p></td></tr>`;
            } else {
                tbody.innerHTML = sales.slice(0, 10)
                    .map(
                        (s) => `
                    <tr>
                        <td>${s.medicine_name}</td>
                        <td>${s.quantity_sold}</td>
                        <td class="text-green">₹${s.total_price.toFixed(2)}</td>
                        <td class="text-muted">${s.sale_date}</td>
                    </tr>`
                    )
                    .join("");
            }
        }
    } catch { /* handled */ }
}

/** Display sale receipt */
function showReceipt(sale) {
    const receipt = document.getElementById("saleReceipt");
    if (!receipt) return;

    receipt.classList.add("visible");
    receipt.innerHTML = `
        <h3>🧾 Sale Receipt</h3>
        <div class="receipt-row">
            <span>Medicine</span>
            <span>${sale.medicine_name}</span>
        </div>
        <div class="receipt-row">
            <span>Quantity</span>
            <span>${sale.quantity_sold}</span>
        </div>
        <div class="receipt-row">
            <span>Total</span>
            <span>₹${sale.total_price.toFixed(2)}</span>
        </div>
    `;
}


// =============================================
//  PAGE INITIALIZATION (auto-detect page)
// =============================================

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (path === "/" || path === "/index.html" || path === "/login.html") {
        initLogin();
    } else if (path === "/dashboard") {
        initDashboard();
    } else if (path === "/medicines-page") {
        initMedicines();
    } else if (path === "/add-page") {
        initAddMedicine();
    } else if (path === "/billing-page") {
        initBilling();
    }
});
