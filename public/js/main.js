import { setActiveScene } from "/js/three-scenes.js";

/* =========================================================
   Helpers
   ========================================================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmt = (n) => `$${Number(n).toFixed(2)}`;

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function showToast(msg, ms = 2600) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), ms);
}

/* =========================================================
   WhatsApp bridge
   ---------------------------------------------------------
   The phone number never appears in this file, in index.html,
   or in styles.css. Every action asks the backend
   (`/api/contact-link` or `/api/checkout`) for a ready-made
   wa.me link at the moment of the click, then opens it.
   ========================================================= */
async function openWhatsApp({ src = "site", text = "" } = {}) {
  try {
    const params = new URLSearchParams({ src });
    if (text) params.set("text", text);
    const data = await fetchJSON(`/api/contact-link?${params.toString()}`);
    window.open(data.url, "_blank", "noopener");
  } catch (err) {
    console.error(err);
    showToast("Could not reach chat right now — please try again.");
  }
}

document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-wa]");
  if (!trigger) return;
  e.preventDefault();
  const src = trigger.getAttribute("data-wa-src") || "site";
  const text = trigger.getAttribute("data-wa-msg") || "";
  openWhatsApp({ src, text });
});

/* =========================================================
   Product data cache
   ========================================================= */
const state = {
  products: [],
  categories: [],
  cart: JSON.parse(localStorage.getItem("nexus_cart") || "{}"),
};

function saveCart() {
  localStorage.setItem("nexus_cart", JSON.stringify(state.cart));
  updateCartUI();
}

function addToCart(id, qty = 1) {
  state.cart[id] = (state.cart[id] || 0) + qty;
  saveCart();
  const product = state.products.find((p) => p.id === id);
  showToast(`✓ Added "${product ? product.name : "item"}" to cart`);
}

function removeFromCart(id) {
  delete state.cart[id];
  saveCart();
}

function setQty(id, qty) {
  if (qty <= 0) return removeFromCart(id);
  state.cart[id] = qty;
  saveCart();
}

function cartCount() {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}

function cartTotal() {
  return Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const p = state.products.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function updateCartUI() {
  $("#cartBadge").textContent = cartCount();
  const container = $("#cartItems");
  const entries = Object.entries(state.cart);

  if (entries.length === 0) {
    container.innerHTML = `<div class="cart-empty">Your cart is empty.<br/>Browse products and hit "Add to Cart".</div>`;
  } else {
    container.innerHTML = entries
      .map(([id, qty]) => {
        const p = state.products.find((x) => x.id === id);
        if (!p) return "";
        return `
          <div class="cart-item" data-id="${id}">
            <div class="cart-item-thumb" style="background:${p.gradient}"></div>
            <div class="cart-item-info">
              <h5>${p.name}</h5>
              <span>${fmt(p.price)} each</span>
            </div>
            <div class="cart-qty">
              <button data-action="dec">−</button>
              <span>${qty}</span>
              <button data-action="inc">+</button>
            </div>
            <button class="cart-remove" data-action="remove">✕</button>
          </div>`;
      })
      .join("");
  }
  $("#cartTotal").textContent = fmt(cartTotal());
}

$("#cartItems").addEventListener("click", (e) => {
  const item = e.target.closest(".cart-item");
  if (!item) return;
  const id = item.dataset.id;
  const action = e.target.dataset.action;
  if (action === "inc") setQty(id, (state.cart[id] || 0) + 1);
  if (action === "dec") setQty(id, (state.cart[id] || 0) - 1);
  if (action === "remove") removeFromCart(id);
});

$("#checkoutBtn").addEventListener("click", async () => {
  const items = Object.entries(state.cart)
    .map(([id, qty]) => {
      const p = state.products.find((x) => x.id === id);
      return p ? { name: p.name, qty, price: p.price } : null;
    })
    .filter(Boolean);

  if (items.length === 0) {
    showToast("Your cart is empty.");
    return;
  }

  try {
    const data = await fetchJSON("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, src: "cart-drawer" }),
    });
    window.open(data.url, "_blank", "noopener");
    showToast(`Order #${data.orderId} sent to chat ✓`);
  } catch (err) {
    console.error(err);
    showToast("Checkout failed — please try again.");
  }
});

/* =========================================================
   Rendering: product cards
   ========================================================= */
function stars(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function badgeClass(badge) {
  return (
    {
      NEW: "badge-new",
      HOT: "badge-hot",
      DEAL: "badge-deal",
      PRO: "badge-pro",
    }[badge] || "badge-new"
  );
}

function productCardHTML(p) {
  return `
  <article class="product-card" data-id="${p.id}">
    <div class="pc-image" style="background:${p.gradient}">
      <div class="pc-badges"><span class="badge ${badgeClass(p.badge)}">${p.badge}</span></div>
    </div>
    <div class="pc-body">
      <span class="pc-brand">${p.brand}</span>
      <h4 class="pc-name">${p.name}</h4>
      <div class="pc-specs">
        ${Object.values(p.specs)
          .slice(0, 3)
          .map((s) => `<span class="chip">${s}</span>`)
          .join("")}
      </div>
      <div class="pc-rating"><span class="stars">${stars(p.rating)}</span> ${p.rating} (${p.reviews})</div>
      <div class="pc-price-row">
        <span class="price-old">${fmt(p.originalPrice)}</span>
        <span class="price-new">${fmt(p.price)}</span>
      </div>
      <div class="pc-actions">
        <button class="btn btn-neon btn-sm" data-action="add" data-id="${p.id}">Quick Add</button>
        <button class="btn btn-outline btn-sm" data-action="inquire" data-id="${p.id}">Compare</button>
      </div>
    </div>
  </article>`;
}

function renderGrid(el, list) {
  if (!el) return;
  el.innerHTML = list.map(productCardHTML).join("") || `<p style="color:var(--text-dim)">No products found.</p>`;
}

document.addEventListener("click", (e) => {
  const addBtn = e.target.closest('[data-action="add"]');
  if (addBtn) {
    addToCart(addBtn.dataset.id, 1);
    return;
  }
  const inquireBtn = e.target.closest('[data-action="inquire"]');
  if (inquireBtn) {
    const p = state.products.find((x) => x.id === inquireBtn.dataset.id);
    if (p) {
      openWhatsApp({
        src: "compare",
        text: `Hi NEXUS STORE, can you help me compare the ${p.name} with similar alternatives in ${p.category}?`,
      });
    }
    return;
  }
});

/* =========================================================
   Category grid + compare table + deals
   ========================================================= */
function renderCategories(categories) {
  const grid = $("#categoryGrid");
  if (!grid) return;
  grid.innerHTML = categories
    .map(
      (c) => `
    <a href="#/products" class="category-cell" data-cat="${c.id}">
      <span class="category-count">${c.count} items</span>
      <span class="category-icon">${c.icon}</span>
      <h4>${c.label}</h4>
    </a>`
    )
    .join("");
}

function renderCompareTable(products) {
  const table = $("#compareTable");
  if (!table) return;
  const picks = ["p-nova-x1", "p-quantum-book", "p-strike-console"]
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);
  if (picks.length < 3) return;
  const bestIdx = 0; // Nova X1 Pro highlighted as best value

  const rows = [
    ["Price", (p) => fmt(p.price)],
    ["RAM", (p) => p.specs.RAM],
    ["Storage", (p) => p.specs.Storage],
    ["Processor", (p) => p.specs.Processor],
    ["Rating", (p) => `${p.rating} ★ (${p.reviews})`],
  ];

  table.innerHTML = `
    <thead>
      <tr>
        <th></th>
        ${picks.map((p, i) => `<th class="${i === bestIdx ? "compare-best" : ""}">${i === bestIdx ? '<div class="compare-best-tag">BEST VALUE</div>' : ""}${p.name}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          <td>${row[0]}</td>
          ${picks.map((p, i) => `<td class="${i === bestIdx ? "compare-best" : ""}">${row[1](p)}</td>`).join("")}
        </tr>`
        )
        .join("")}
    </tbody>`;
}

/* =========================================================
   Countdown timer
   ========================================================= */
let dealsEndsAt = null;

function tickCountdown() {
  if (!dealsEndsAt) return;
  const diff = Math.max(0, dealsEndsAt.getTime() - Date.now());
  const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  ["cdH", "cdH2"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = h; });
  ["cdM", "cdM2"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = m; });
  ["cdS", "cdS2"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = s; });
}
setInterval(tickCountdown, 1000);

/* =========================================================
   Filter bar (Products page)
   ========================================================= */
function setupFilterBar(categories) {
  const bar = $("#filterBar");
  if (!bar) return;
  categories.forEach((c) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.dataset.filter = c.id;
    chip.textContent = c.label;
    bar.appendChild(chip);
  });

  bar.addEventListener("click", (e) => {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;
    $$(".filter-chip", bar).forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const filter = chip.dataset.filter;
    const list = filter === "all" ? state.products : state.products.filter((p) => p.category === filter);
    renderGrid($("#allProductsGrid"), list);
  });
}

/* =========================================================
   Data bootstrap
   ========================================================= */
async function loadData() {
  const [{ products }, categories, deals] = await Promise.all([
    fetchJSON("/api/products"),
    fetchJSON("/api/categories"),
    fetchJSON("/api/deals"),
  ]);

  state.products = products;
  state.categories = categories;
  dealsEndsAt = new Date(deals.endsAt);
  tickCountdown();

  renderGrid($("#featuredGrid"), products.filter((p) => p.tags.includes("featured")).slice(0, 8));
  renderGrid($("#allProductsGrid"), products);
  renderGrid($("#dealScroll"), deals.deals);
  renderGrid($("#dealsGrid"), deals.deals);
  renderGrid($("#gamingGrid"), products.filter((p) => p.category === "gaming"));
  renderGrid($("#proGrid"), products.filter((p) => p.tags.includes("pro")));
  renderCategories(categories);
  renderCompareTable(products);
  setupFilterBar(categories);
  updateCartUI();
}

/* =========================================================
   Search overlay
   ========================================================= */
const searchOverlay = $("#searchOverlay");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");
let searchDebounce;

function openSearch() {
  searchOverlay.classList.add("open");
  setTimeout(() => searchInput.focus(), 150);
}
function closeSearch() {
  searchOverlay.classList.remove("open");
}
$("#searchBtn").addEventListener("click", openSearch);
$("#searchClose").addEventListener("click", closeSearch);
searchOverlay.addEventListener("click", (e) => {
  if (e.target === searchOverlay) closeSearch();
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openSearch();
  }
  if (e.key === "Escape") closeSearch();
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  searchDebounce = setTimeout(async () => {
    if (!q) {
      searchResults.innerHTML = "";
      return;
    }
    try {
      const { products } = await fetchJSON(`/api/products?q=${encodeURIComponent(q)}`);
      searchResults.innerHTML = products
        .map(
          (p) => `<div class="search-result-item" data-id="${p.id}">
            <strong>${p.name}</strong>
            <span>${fmt(p.price)}</span>
          </div>`
        )
        .join("") || `<p style="color:var(--text-dim)">No matches. Ask us on chat instead?</p>`;
    } catch {
      searchResults.innerHTML = "";
    }
  }, 220);
});

searchResults.addEventListener("click", (e) => {
  const item = e.target.closest(".search-result-item");
  if (!item) return;
  addToCart(item.dataset.id, 1);
  closeSearch();
});

/* =========================================================
   Palette drawer
   ========================================================= */
const paletteDrawer = $("#paletteDrawer");
const cartDrawer = $("#cartDrawer");
const backdrop = $("#drawerBackdrop");

function openDrawer(drawer) {
  drawer.classList.add("open");
  backdrop.classList.add("show");
}
function closeDrawers() {
  paletteDrawer.classList.remove("open");
  cartDrawer.classList.remove("open");
  backdrop.classList.remove("show");
}
$("#paletteBtn").addEventListener("click", () => openDrawer(paletteDrawer));
$("#paletteClose").addEventListener("click", closeDrawers);
$("#cartBtn").addEventListener("click", () => openDrawer(cartDrawer));
$("#cartClose").addEventListener("click", closeDrawers);
backdrop.addEventListener("click", closeDrawers);

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("nexus_theme", theme);
  $$(".palette-opt").forEach((btn) => btn.classList.toggle("active", btn.dataset.theme === theme));
}
$$(".palette-opt").forEach((btn) => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
});
applyTheme(localStorage.getItem("nexus_theme") || "cyber-night");

/* =========================================================
   Mobile nav
   ========================================================= */
const hamburgerBtn = $("#hamburgerBtn");
const mobileNav = $("#mobileNav");
hamburgerBtn.addEventListener("click", () => mobileNav.classList.toggle("open"));
$$("#mobileNav a").forEach((a) => a.addEventListener("click", () => mobileNav.classList.remove("open")));

/* =========================================================
   Hero counters
   ========================================================= */
function animateCounters() {
  $$(".counter-num").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimal || "0", 10);
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals).replace(/\.0$/, decimals ? "" : "");
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = decimals ? target.toFixed(decimals) : Math.round(target).toLocaleString();
    }
    requestAnimationFrame(step);
  });
}

/* =========================================================
   Hash router
   ========================================================= */
const routes = ["home", "products", "deals", "gaming", "pro", "about"];

function resolveRoute() {
  const hash = location.hash.replace("#/", "").split("?")[0];
  return routes.includes(hash) ? hash : "home";
}

function renderRoute() {
  const route = resolveRoute();
  document.body.dataset.route = route;

  $$(".route").forEach((sec) => sec.classList.toggle("active", sec.dataset.route === route));
  $$("[data-route-link]").forEach((a) => a.classList.toggle("active", a.dataset.routeLink === route));

  setActiveScene(route);

  // Reset virtual scroll target for the new page.
  window.scrollTo(0, 0);
  currentScroll = 0;
  targetScroll = 0;
  lastSetScroll = 0;

  if (route === "home") animateCounters();
}

window.addEventListener("hashchange", renderRoute);

/* =========================================================
   Custom scroll physics
   LERP 0.12 · WHEEL_MULT 1.2 (mouse-repulsion lives in three-scenes.js)
   Wheel input is smoothed; touch / keyboard / scrollbar pass through natively.
   ========================================================= */
const LERP = 0.12;
const WHEEL_MULT = 1.2;
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

let currentScroll = window.scrollY;
let targetScroll = window.scrollY;
let lastSetScroll = window.scrollY;

if (!isCoarsePointer) {
  window.addEventListener(
    "wheel",
    (e) => {
      if (document.body.classList.contains("no-scroll")) return;
      e.preventDefault();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      targetScroll = Math.max(0, Math.min(max, targetScroll + e.deltaY * WHEEL_MULT));
    },
    { passive: false }
  );
}

function scrollLoop() {
  if (Math.abs(window.scrollY - lastSetScroll) > 1.5) {
    currentScroll = window.scrollY;
    targetScroll = window.scrollY;
  }
  currentScroll += (targetScroll - currentScroll) * LERP;
  if (Math.abs(currentScroll - window.scrollY) > 0.4) {
    window.scrollTo(0, currentScroll);
    lastSetScroll = currentScroll;
  } else {
    lastSetScroll = window.scrollY;
  }
  requestAnimationFrame(scrollLoop);
}
scrollLoop();

/* Header hide-on-scroll-down */
let lastY = window.scrollY;
window.addEventListener("scroll", () => {
  const header = $("#siteHeader");
  const y = window.scrollY;
  if (y > lastY && y > 140) header.classList.add("hide-header");
  else header.classList.remove("hide-header");
  lastY = y;
});

/* =========================================================
   Loader sequence
   ========================================================= */
const loaderSteps = ["Booting system...", "Loading drivers...", "Connecting to inventory...", "Ready."];
function runLoader() {
  const stepEl = $("#loaderStep");
  const bar = $("#loaderBarFill");
  let i = 0;
  bar.style.width = "10%";
  const interval = setInterval(() => {
    i++;
    if (i < loaderSteps.length) {
      stepEl.textContent = loaderSteps[i];
      bar.style.width = `${25 + i * 25}%`;
    }
    if (i >= loaderSteps.length - 1) {
      clearInterval(interval);
      setTimeout(() => $("#loader").classList.add("hidden"), 500);
    }
  }, 480);
}

/* =========================================================
   Boot
   ========================================================= */
(async function init() {
  $("#year").textContent = new Date().getFullYear();
  runLoader();
  try {
    await loadData();
  } catch (err) {
    console.error("Failed to load catalog", err);
    showToast("Could not load live inventory — showing cached view.");
  }
  renderRoute();
})();
