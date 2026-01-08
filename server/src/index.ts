import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { campaignRouter } from './routes/campaigns.js';
import { sessionRouter } from './routes/sessions.js';
import { playerRouter } from './routes/players.js';
import { npcRouter } from './routes/npcs.js';
import { soundMappingRouter } from './routes/soundMappings.js';
import { audioLibraryRouter } from './routes/audioLibrary.js';
import { setupWebSocket } from './websocket/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/campaigns', authMiddleware, campaignRouter);
app.use('/api/sessions', authMiddleware, sessionRouter);
app.use('/api/players', authMiddleware, playerRouter);
app.use('/api/npcs', authMiddleware, npcRouter);
app.use('/api/sound-mappings', authMiddleware, soundMappingRouter);
app.use('/api/audio-library', authMiddleware, audioLibraryRouter);

// Error handler
app.use(errorHandler);

// WebSocket setup
setupWebSocket(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`🎲 D&D Companion server running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});

export { app, io };


