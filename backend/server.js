const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocket.Server({ noServer: true });

// Store client connections
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('🔌 New WebSocket client connected! Total clients:', clients.size);
  
  ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to InventAI Live Real-Time Stream' }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log('🔌 Client disconnected. Total clients:', clients.size);
  });
});

// Broadcast Helper
function broadcast(type, payload) {
  const data = JSON.stringify({ type, payload });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Make broadcast accessible to routes
app.set('broadcast', broadcast);

// Initialize Centralized Alert & Systems Engine
const { initializeAlertEngine } = require('./services/alertEngine');
initializeAlertEngine(app);

const apiRoutes = require('./routes/api');

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Status: ${res.statusCode}`);
  });
  next();
});
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('Smart Inventory Management API is running with WebSockets...');
});

const PORT = process.env.PORT || 5000;

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
