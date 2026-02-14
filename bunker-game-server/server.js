const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // В продакшене заменить на URL вашего хостинга
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
async function ensureDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir);
    }
}

// Routes
const lobbyRoutes = require('./routes/lobby');
const gameRoutes = require('./routes/game');

app.use('/api/lobby', lobbyRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
const lobbyManager = require('./logic/lobbyManager');

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_lobby', async ({ lobbyId, playerId, nickname }) => {
        try {
            socket.join(lobbyId);
            const player = await lobbyManager.joinLobby(lobbyId, playerId, nickname, socket.id);
            io.to(lobbyId).emit('player_joined', player);
            const lobby = await lobbyManager.getLobby(lobbyId);
            socket.emit('lobby_state', lobby);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('reconnect_to_lobby', async ({ lobbyId, playerId }) => {
        try {
            socket.join(lobbyId);
            const player = await lobbyManager.reconnectPlayer(lobbyId, playerId, socket.id);
            io.to(lobbyId).emit('player_reconnected', player);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('start_game', async ({ lobbyId, gameDataFromClient }) => {
        try {
            const gameData = await lobbyManager.startGame(lobbyId, gameDataFromClient);
            io.to(lobbyId).emit('game_started', gameData);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('reveal_character', async ({ lobbyId, playerId }) => {
        try {
            await lobbyManager.revealCharacter(lobbyId, playerId);
            io.to(lobbyId).emit('character_revealed', { playerId });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('play_sound', ({ lobbyId, soundFile }) => {
        io.to(lobbyId).emit('play_sound', { soundFile });
    });

    socket.on('start_voting', ({ lobbyId, duration = 15 }) => {
        io.to(lobbyId).emit('voting_started', { duration });
    });

    socket.on('end_voting', ({ lobbyId }) => {
        io.to(lobbyId).emit('voting_ended');
    });

    socket.on('vote', ({ lobbyId, voterId, targetId }) => {
        io.to(lobbyId).emit('vote_cast', { voterId, targetId });
    });

    socket.on('kick_player', async ({ lobbyId, hostId, playerId }) => {
        try {
            await lobbyManager.kickPlayer(lobbyId, hostId, playerId);
            io.to(lobbyId).emit('player_kicked', { playerId });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('set_player_dead', async ({ lobbyId, hostId, playerId }) => {
        try {
            await lobbyManager.setPlayerDead(lobbyId, hostId, playerId);
            io.to(lobbyId).emit('player_killed', { playerId });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('transfer_host', async ({ lobbyId, currentHostId, newHostId }) => {
        try {
            await lobbyManager.transferHost(lobbyId, currentHostId, newHostId);
            io.to(lobbyId).emit('host_changed', { newHostId });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('update_character', async ({ lobbyId, hostId, playerId, updates }) => {
        try {
            await lobbyManager.updateCharacter(lobbyId, hostId, playerId, updates);
            io.to(lobbyId).emit('character_updated', { playerId, updates });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('disconnect', async () => {
        try {
            await lobbyManager.handleDisconnect(socket.id);
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    });
});

// Start server
async function start() {
    await ensureDataDirectory();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();