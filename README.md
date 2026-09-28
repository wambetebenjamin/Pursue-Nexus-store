# NEXUS STORE

**"Power your future."** — a premium, single-page tech electronics storefront
with a full Node/Express backend and a Three.js-powered front end.

Every purchase action (Shop Now, Add to Cart, Get Pro, Checkout, Sign In,
footer links, etc.) opens a WhatsApp chat pre-filled with the right message.
**The WhatsApp number is never written into any HTML/CSS/JS file** — it lives
only in `server/.env` and the frontend asks the backend for a ready-made
`wa.me` link at the moment you click.

## Project structure

```
server/                Express backend
  server.js            Routes, catalog API, WhatsApp link brokering
  data/products.js      Product & category catalog (source of truth)
  data/orders.json      Append-only log of checkout requests (auto-created)
  .env                  WHATSAPP_NUMBER + PORT (not committed)
  .env.example          Template for the above

public/                 Static frontend (served by Express)
  index.html            Multi-page SPA (hash routing): Home, Products,
                         Deals, Gaming, Pro, About
  css/styles.css        Design system: neon glassmorphism, 4 display themes
  js/three-scenes.js    Three.js scenes (chrome spheres/DNA helix on Home,
                         holographic product boxes, neural-network About page)
  js/main.js            Routing, cart, search, palette switcher, countdown,
                         WhatsApp bridge, custom scroll physics
```

## Running it

```bash
cd server
npm install
cp .env.example .env      # already done in this workspace
npm start                 # -> http://localhost:4000
```

The Express server serves the frontend **and** the API from the same origin
(port 4000 by default, binds to `0.0.0.0`).

## How the WhatsApp integration works

1. Every clickable "shop" action in `index.html` carries `data-wa`,
   `data-wa-src`, and (optionally) `data-wa-msg` attributes — no phone number,
   no `wa.me` link anywhere in the markup.
2. `main.js` listens for clicks on `[data-wa]` and calls
   `GET /api/contact-link?src=...&text=...`.
3. `server.js` reads `WHATSAPP_NUMBER` from `.env`, builds
   `https://wa.me/<number>?text=<message>`, and returns it as JSON.
4. The browser opens that URL in a new tab.

Cart checkout works the same way but via `POST /api/checkout`, which also
itemizes the cart into a readable order message, assigns an order ID, and
appends a record to `server/data/orders.json` for basic order tracking.

A plain-link fallback also exists at `GET /go/whatsapp?src=&text=` (302
redirect) for non-JS contexts — the number still never touches the frontend
bundle, only the `Location` response header at click-time.

## API reference

| Method | Path                  | Description                                   |
|--------|-----------------------|------------------------------------------------|
| GET    | `/api/products`       | List products (`?category=`, `?tag=`, `?q=`)   |
| GET    | `/api/products/:id`   | Single product                                 |
| GET    | `/api/categories`     | Categories with live counts                    |
| GET    | `/api/deals`          | Deal products + countdown end time             |
| GET    | `/api/contact-link`   | Returns a `{ url }` WhatsApp deep link         |
| POST   | `/api/checkout`       | `{ items, note, src }` → `{ orderId, url }`    |
| GET    | `/go/whatsapp`        | 302 redirect fallback                          |

## Deploying to Vercel

This repo is zero-config for Vercel:

- `public/` is served directly as static assets (Vercel auto-serves a
  top-level `public` directory).
- `api/[...slug].js` is a catch-all serverless function that hands every
  `/api/**` request straight to the same Express app used locally
  (`server/server.js`).
- `vercel.json` adds one rewrite so the `/go/whatsapp` fallback link also
  resolves in production.

**[Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwambetebenjamin%2FPursue-Nexus-store%2Ftree%2Farena%2F01a0e7b8-pursue-nexus-store&env=WHATSAPP_NUMBER&envDescription=Digits-only%20WhatsApp%20number%20used%20to%20build%20wa.me%20checkout%20links%20(country%20code%2C%20no%20%2B%2C%20no%20spaces)&project-name=nexus-store&repository-name=nexus-store)**

When you click it, Vercel will:
1. Ask you to fork the repo into your own GitHub/GitLab/Bitbucket account.
2. Prompt you to fill in the `WHATSAPP_NUMBER` environment variable
   (digits only, e.g. `254112272061` — no `+`, no spaces). This is the only
   place the number needs to be configured; it's never committed to the repo.
3. Deploy automatically — no build command or extra settings required.

If you deploy from the Vercel dashboard manually instead of the button, just
make sure to add `WHATSAPP_NUMBER` under Project → Settings → Environment
Variables before (or right after) the first deploy, then redeploy.

## Design system

- **Brand colors:** `#0D0D0D` near-black, `#00FF88` neon green,
  `#7C3AED` electric violet, `#1A1A2E` dark navy, `#00D4FF` cyan accent.
- **Display Mode switcher:** Cyber Night, Deep Space, Violet Matrix,
  Holographic — swaps the accent palette live via CSS variables.
- **Pages:** Home (hero, featured grid, flash deals with countdown,
  category grid, flagship comparison table, stat cards), Products (full
  catalog with filters), Deals, Gaming, Pro (membership perks), About.
- **3D scenes:** chrome spheres + hex prisms morphing between a DNA helix,
  a "crash scatter," a circuit-board trace grid, and incoming data packets
  as you scroll the Home page; holographic floating product boxes; a
  particle neural network that contracts into a brain silhouette on About.
