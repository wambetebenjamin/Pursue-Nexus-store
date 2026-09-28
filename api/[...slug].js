// Vercel serverless entry point.
//
// Vercel auto-detects any file under /api as a function; this catch-all
// ([...slug]) matches every request under /api/**, and our Express app
// (server/server.js) already defines all of its routes under /api/* (plus a
// /go/whatsapp alias), so we simply hand the request straight to it.
//
// Static assets in /public are served directly by Vercel's zero-config
// static hosting — they never touch this function.
module.exports = require("../server/server.js");
