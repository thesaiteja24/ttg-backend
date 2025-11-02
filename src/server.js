import { configDotenv } from "dotenv";
import { app } from "./app.js";
import { connectDB } from "./db/index.js";
import { WebSocketServer } from "ws";
import http from "http";

configDotenv({ quiet: true });

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Store clients by yearSemesterId
const clients = new Map();

// Handle WebSocket connections
wss.on("connection", (ws, req) => {
  const yearSemesterId = req.url.split("/").pop();
  console.log(`WebSocket connected for yearSemesterId: ${yearSemesterId}`);
  clients.set(yearSemesterId, ws);
  ws.on("close", () => {
    console.log(`WebSocket disconnected for yearSemesterId: ${yearSemesterId}`);
    clients.delete(yearSemesterId);
  });
});

// Handle WebSocket upgrade
server.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/api/timetable/stream/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Function to send progress messages to a specific yearSemesterId
export const sendProgress = (yearSemesterId, message, progress) => {
  const ws = clients.get(yearSemesterId);
  if (ws) {
    ws.send(JSON.stringify({ message, progress }));
  }
};

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  });
