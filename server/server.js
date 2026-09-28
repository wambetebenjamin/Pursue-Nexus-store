require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const { products, categories } = require("./data/products");

const app = express();
const PORT = process.env.PORT || 4000;

// The WhatsApp destination lives ONLY here, in server memory (from .env).
// It is deliberately never written into any file under /public, so nobody
// reading the frontend source (HTML/CSS/JS) can find the raw number — every
// "Shop Now / Add to Cart / Get Pro / Checkout" action asks this backend for
// a fresh link right before opening it.
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
if (!WHATSAPP_NUMBER) {
  console.warn("[nexus] WARNING: WHATSAPP_NUMBER is not set in server/.env");
}

const ORDERS_FILE = path.join(__dirname, "data", "orders.json");
function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function buildWhatsAppUrl(text) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

app.disable("x-powered-by");
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Basic hardening headers (kept dependency-free).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// ---------- Catalog API ----------
app.get("/api/products", (req, res) => {
  const { category, tag, q } = req.query;
  let list = products;
  if (category) list = list.filter((p) => p.category === category);
  if (tag) list = list.filter((p) => p.tags?.includes(tag));
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.brand.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle)
    );
  }
  res.json({ count: list.length, products: list });
});

app.get("/api/products/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json(product);
});

app.get("/api/categories", (req, res) => {
  const withCounts = categories.map((c) => ({
    ...c,
    count: products.filter((p) => p.category === c.id).length
  }));
  res.json(withCounts);
});

app.get("/api/deals", (req, res) => {
  const deals = products.filter((p) => p.tags?.includes("deal"));
  // Deterministic-ish rolling countdown target (server authoritative).
  const endsAt = new Date();
  endsAt.setHours(endsAt.getHours() + 8, endsAt.getMinutes() + 30, 0, 0);
  res.json({ endsAt: endsAt.toISOString(), deals });
});

// ---------- WhatsApp brokering ----------
// The frontend NEVER embeds wa.me/<number> directly. It calls this endpoint,
// gets back a ready-made URL, then opens it. The number stays server-side.
app.get("/api/contact-link", contactLimiter, (req, res) => {
  const { src = "general", text = "" } = req.query;
  const message =
    text ||
    `Hi NEXUS STORE 👋 I'm reaching out from the website (${src}). I'd like to know more.`;
  res.json({ url: buildWhatsAppUrl(message), src });
});

app.post("/api/checkout", contactLimiter, (req, res) => {
  const { items = [], note = "", src = "cart" } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty." });
  }

  const safeItems = items
    .filter((i) => i && i.name && Number(i.qty) > 0)
    .map((i) => ({
      name: String(i.name).slice(0, 120),
      qty: Math.max(1, Math.min(99, Number(i.qty) || 1)),
      price: Number(i.price) || 0
    }));

  if (safeItems.length === 0) {
    return res.status(400).json({ error: "Invalid cart items." });
  }

  const total = safeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const orderId = crypto.randomBytes(4).toString("hex").toUpperCase();

  const lines = [
    `Hi NEXUS STORE 👋 I'd like to place an order (Ref #${orderId}):`,
    "",
    ...safeItems.map((i) => `• ${i.name}  x${i.qty}  — $${(i.price * i.qty).toFixed(2)}`),
    "",
    `Total: $${total.toFixed(2)}`,
    note ? `Note: ${String(note).slice(0, 300)}` : null,
    "",
    `Source: ${src}`
  ].filter(Boolean);

  const message = lines.join("\n");

  appendOrder({
    orderId,
    items: safeItems,
    total,
    note,
    src,
    createdAt: new Date().toISOString()
  });

  res.json({ orderId, url: buildWhatsAppUrl(message) });
});

// Plain-link fallback for non-JS contexts (still resolves server-side only).
app.get("/go/whatsapp", contactLimiter, (req, res) => {
  const { src = "link", text = "" } = req.query;
  const message =
    text || `Hi NEXUS STORE 👋 I'm reaching out from the website (${src}).`;
  res.redirect(302, buildWhatsAppUrl(message));
});

// ---------- Static frontend ----------
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/go/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXUS STORE server running on http://0.0.0.0:${PORT}`);
});
