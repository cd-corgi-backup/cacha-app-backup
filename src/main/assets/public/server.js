// server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const WebSocket = require("ws");

const PORT = 3000;
const DIST_DIR = path.join(process.cwd(), "dist");

// Función para obtener la IP local (útil para probar en Android por Wi-Fi)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url === "/" ? "index.html" : req.url);

  if (!path.extname(filePath)) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Archivo no encontrado");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// --- LÓGICA DE WEBSOCKET PARA CERRAR LA APP EN WINDOWS ---
const wss = new WebSocket.Server({ server });
let activeConnections = 0;
let closeTimeout = null;

wss.on("connection", (ws) => {
  activeConnections++;
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }

  ws.on("close", () => {
    activeConnections--;
    if (activeConnections === 0) {
      // Esperamos 5 segundos por si el usuario presionó F5
      closeTimeout = setTimeout(() => {
        if (activeConnections === 0) {
          console.log("\nNavegador cerrado. Apagando servidor...");
          process.exit(0);
        }
      }, 5000);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const localIP = getLocalIP();
  console.log(`\n✅ Servidor corriendo:`);
  console.log(`   - En esta PC: http://localhost:${PORT}`);
  console.log(
    `   - En tu red local (celular/tablet): http://${localIP}:${PORT}\n`,
  );

  // Abrimos el navegador solo si estamos en Windows
  if (process.platform === "win32") {
    exec(`start http://localhost:${PORT}`);
  }
});
