const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const rooms = new Map();
const clients = new Map();

function randomRoom() {
  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  throw new Error("No room codes available");
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function leave(ws) {
  const state = clients.get(ws);
  if (!state) return;
  clients.delete(ws);
  const room = state.room ? rooms.get(state.room) : null;
  if (!room) return;
  if (room.host === ws) {
    if (room.guest) send(room.guest, { type: "peerLeft" });
    rooms.delete(state.room);
  } else if (room.guest === ws) {
    room.guest = null;
    if (room.host) send(room.host, { type: "peerLeft" });
  }
}

const MIME = {
  ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".wasm":"application/wasm", ".png":"image/png", ".webm":"video/webm", ".svg":"image/svg+xml"
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || "/").split("?")[0]); }
  catch (_) { res.writeHead(400); return res.end("Bad request"); }
  if (urlPath === "/healthz") {
    res.writeHead(200, {"content-type":"text/plain; charset=utf-8"});
    return res.end("ok");
  }
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  clients.set(ws, { id: crypto.randomUUID(), room: null, role: null });

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return send(ws, {type:"error", message:"Invalid message."}); }
    const state = clients.get(ws);
    if (!state) return;

    if (msg.type === "create") {
      if (state.room) return send(ws, {type:"error", message:"Already in a room."});
      const code = randomRoom();
      rooms.set(code, { host: ws, guest: null });
      state.room = code; state.role = "host";
      return send(ws, {type:"created", room:code});
    }

    if (msg.type === "join") {
      if (state.room) return send(ws, {type:"error", message:"Already in a room."});
      const code = String(msg.room || "").replace(/\D/g, "").slice(0,4);
      const room = rooms.get(code);
      if (!room || room.guest) return send(ws, {type:"error", message:"Room not found or already full."});
      room.guest = ws;
      state.room = code; state.role = "guest";
      send(ws, {type:"joined", room:code});
      send(room.host, {type:"playerJoined"});
      return;
    }

    const room = state.room ? rooms.get(state.room) : null;
    if (!room) return send(ws, {type:"error", message:"Create or join a room first."});

    if (msg.type === "ready") {
      if (state.role === "host") room.hostReady = true;
      if (state.role === "guest") room.guestReady = true;
      if (room.hostReady && room.guestReady) {
        send(room.host, {type:"start"});
        send(room.guest, {type:"start"});
      }
      return;
    }

    if (msg.type === "input" && state.role === "guest") {
      return send(room.host, msg);
    }
    if (msg.type === "snapshot" && state.role === "host") {
      return send(room.guest, msg);
    }
  });

  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});

server.listen(PORT, "0.0.0.0", () => console.log(`Basket Random server listening on ${PORT}`));
