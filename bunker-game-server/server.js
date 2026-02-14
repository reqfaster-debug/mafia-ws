const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

// Настройка CORS для Socket.IO
const io = new Server(server, {
    cors: {
        origin: [
            'https://bunker-game.netlify.app',  // Ваш Netlify URL
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware для CORS - ЭТО САМОЕ ВАЖНОЕ!
app.use((req, res, next) => {
    // Разрешаем запросы с вашего Netlify домена
    res.header('Access-Control-Allow-Origin', 'https://bunker-game.netlify.app');
    // Разрешаем credentials (cookies, авторизацию)
    res.header('Access-Control-Allow-Credentials', 'true');
    // Разрешаем нужные методы
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // Разрешаем нужные заголовки
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Обрабатываем preflight запросы
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// Или можно использовать готовый cors middleware:
// app.use(cors({
//     origin: 'https://bunker-game.netlify.app',
//     credentials: true
// }));

app.use(express.json());

// Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health check - теперь с правильными заголовками
app.get('/health', (req, res) => {
    console.log('Health check from:', req.headers.origin);
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Server is running',
        cors: 'enabled'
    });
});

// Routes
const lobbyRoutes = require('./routes/lobby');
const gameRoutes = require('./routes/game');

app.use('/api/lobby', lobbyRoutes);
app.use('/api/game', gameRoutes);

// Socket.IO
const lobbyManager = require('./logic/lobbyManager');

io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

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

    socket.on('update_nickname', async ({ lobbyId, playerId, newNickname }) => {
        try {
            if (!newNickname || newNickname.length > 20) {
                socket.emit('error', { message: 'Ник должен быть от 1 до 20 символов' });
                return;
            }
            
            const lobby = await lobbyManager.getLobby(lobbyId);
            const player = lobby.players.find(p => p.id === playerId);
            
            if (player) {
                player.nickname = newNickname;
                await lobbyManager.saveLobby(lobbyId, lobby);
                io.to(lobbyId).emit('player_updated', { 
                    id: playerId, 
                    nickname: newNickname 
                });
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('disconnect', async () => {
        console.log('❌ Client disconnected:', socket.id);
        try {
            await lobbyManager.handleDisconnect(socket.id);
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    });
});

// Start server
async function start() {
    try {
        // Создаем папку data если её нет
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir);
        }

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📡 WebSocket server ready`);
            console.log(`🔗 Health check: https://bunker-game-server.onrender.com/health`);
            console.log(`🔗 CORS enabled for: https://bunker-game.netlify.app`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

start();