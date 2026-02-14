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

// Настройка CORS
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
const lobbyRoutes = require('./routes/lobby');
app.use('/api/lobby', lobbyRoutes);

// Логика управления лобби
const lobbyManager = require('./logic/lobbyManager');
const gameGenerator = require('./logic/gameGenerator');

io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // Подключение к лобби
    socket.on('join_lobby', async ({ lobbyId, playerId, nickname }) => {
        try {
            console.log(`📥 join_lobby: ${lobbyId}, ${playerId}, ${nickname}`);
            
            const lobby = await lobbyManager.getLobby(lobbyId);
            
            // Находим игрока
            let player = lobby.players.find(p => p.id === playerId);
            
            if (player) {
                // Обновляем существующего игрока
                player.online = true;
                player.socketId = socket.id;
                if (nickname && nickname !== player.nickname) {
                    player.nickname = nickname;
                }
                console.log(`🔄 Player reconnected: ${player.nickname}`);
            } else {
                // Создаем нового игрока
                player = {
                    id: playerId || uuidv4(),
                    nickname: nickname || 'Игрок',
                    online: true,
                    socketId: socket.id,
                    revealed: false,
                    alive: true,
                    character: {}
                };
                lobby.players.push(player);
                console.log(`🆕 New player: ${player.nickname}`);
            }
            
            // Сохраняем лобби
            await lobbyManager.saveLobby(lobbyId, lobby);
            
            // Добавляем сокет в комнату
            socket.join(lobbyId);
            
            // Отправляем обновленное состояние всем в лобби
            io.to(lobbyId).emit('lobby_state', lobby);
            
        } catch (error) {
            console.error('❌ join_lobby error:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Старт игры
    socket.on('start_game', async ({ lobbyId, gameDataFromClient }) => {
    try {
        console.log(`📥 start_game: ${lobbyId}`);
        
        // Вызываем метод и получаем обновленное лобби
        const lobby = await lobbyManager.startGame(lobbyId, gameDataFromClient);
        
        // Отправляем события
        io.to(lobbyId).emit('game_started', lobby.gameData);
        io.to(lobbyId).emit('lobby_state', lobby);
        
    } catch (error) {
        console.error('❌ start_game error:', error);
        socket.emit('error', { message: error.message });
    }
});

// Раскрытие характеристики
// Раскрытие характеристики
socket.on('reveal_characteristic', async ({ lobbyId, playerId, field }) => {
    try {
        console.log(`🔓 reveal_characteristic: ${lobbyId}, ${playerId}, ${field}`);
        const lobby = await lobbyManager.revealCharacteristic(lobbyId, playerId, field);
        
        // Отправляем событие о раскрытии
        io.to(lobbyId).emit('characteristic_revealed', { playerId, field });
        
        // Отправляем обновленное состояние лобби
        io.to(lobbyId).emit('lobby_state', lobby);
        
    } catch (error) {
        console.error('❌ reveal_characteristic error:', error);
        socket.emit('error', { message: error.message });
    }
});


    socket.on('reveal_characteristic', async ({ lobbyId, playerId, field }) => {
    try {
        const lobby = await lobbyManager.getLobby(lobbyId);
        const player = lobby.players.find(p => p.id === playerId);
        
        if (player) {
            // Инициализируем массив раскрытых характеристик, если его нет
            if (!player.revealedCharacteristics) {
                player.revealedCharacteristics = [];
            }
            
            // Добавляем характеристику, если её ещё нет
            if (!player.revealedCharacteristics.includes(field)) {
                player.revealedCharacteristics.push(field);
            }
            
            await lobbyManager.saveLobby(lobbyId, lobby);
            
            // Отправляем событие о раскрытии конкретной характеристики
            io.to(lobbyId).emit('characteristic_revealed', { playerId, field });
            io.to(lobbyId).emit('lobby_state', lobby);
        }
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});

    // Изгнать игрока
    socket.on('kick_player', async ({ lobbyId, hostId, playerId }) => {
        try {
            const lobby = await lobbyManager.getLobby(lobbyId);
            if (lobby.host_id !== hostId) {
                throw new Error('Только хост может изгонять игроков');
            }
            lobby.players = lobby.players.filter(p => p.id !== playerId);
            await lobbyManager.saveLobby(lobbyId, lobby);
            io.to(lobbyId).emit('player_kicked', { playerId });
            io.to(lobbyId).emit('lobby_state', lobby);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Объявить игрока мертвым
    socket.on('set_player_dead', async ({ lobbyId, hostId, playerId }) => {
        try {
            const lobby = await lobbyManager.getLobby(lobbyId);
            if (lobby.host_id !== hostId) {
                throw new Error('Только хост может объявлять игроков мертвыми');
            }
            const player = lobby.players.find(p => p.id === playerId);
            if (player) {
                player.alive = false;
                await lobbyManager.saveLobby(lobbyId, lobby);
                io.to(lobbyId).emit('player_killed', { playerId });
                io.to(lobbyId).emit('lobby_state', lobby);
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Вернуть игрока к жизни
    socket.on('revive_player', async ({ lobbyId, hostId, playerId }) => {
        try {
            const lobby = await lobbyManager.getLobby(lobbyId);
            if (lobby.host_id !== hostId) {
                throw new Error('Только хост может возвращать игроков');
            }
            const player = lobby.players.find(p => p.id === playerId);
            if (player) {
                player.alive = true;
                await lobbyManager.saveLobby(lobbyId, lobby);
                io.to(lobbyId).emit('lobby_state', lobby);
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Передать права хоста
    socket.on('transfer_host', async ({ lobbyId, currentHostId, newHostId }) => {
        try {
            const lobby = await lobbyManager.getLobby(lobbyId);
            if (lobby.host_id !== currentHostId) {
                throw new Error('Только текущий хост может передавать права');
            }
            lobby.host_id = newHostId;
            await lobbyManager.saveLobby(lobbyId, lobby);
            io.to(lobbyId).emit('host_changed', { newHostId });
            io.to(lobbyId).emit('lobby_state', lobby);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Обновление характеристик
    socket.on('update_character', async ({ lobbyId, hostId, playerId, updates }) => {
        try {
            const lobby = await lobbyManager.getLobby(lobbyId);
            if (lobby.host_id !== hostId) {
                throw new Error('Только хост может изменять характеристики');
            }
            const player = lobby.players.find(p => p.id === playerId);
            if (player) {
                // Обновляем character, сохраняя структуру
                if (!player.character) player.character = {};
                
                // Обрабатываем обновления
                Object.keys(updates).forEach(key => {
                    if (key === 'health') {
                        // Для здоровья может быть объект или строка
                        if (typeof updates[key] === 'string') {
                            player.character.health = {
                                condition: updates[key],
                                severity: player.character.health?.severity || 'средняя'
                            };
                        } else {
                            player.character.health = updates[key];
                        }
                        
                        // Проверка на критическое здоровье
                        if (player.character.health.severity === 'критическая') {
                            player.alive = false;
                            io.to(lobbyId).emit('health_critical', { playerId });
                            io.to(lobbyId).emit('player_killed', { playerId });
                        }
                    } else if (key === 'profession') {
                        // Для профессии может быть объект или строка
                        if (typeof updates[key] === 'string') {
                            player.character.profession = {
                                name: updates[key],
                                description: '',
                                experience: player.character.profession?.experience || 1
                            };
                        } else {
                            player.character.profession = updates[key];
                        }
                    } else {
                        player.character[key] = updates[key];
                    }
                });
                
                await lobbyManager.saveLobby(lobbyId, lobby);
                io.to(lobbyId).emit('character_updated', { playerId, updates });
                io.to(lobbyId).emit('lobby_state', lobby);
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
// Улучшение здоровья
socket.on('improve_health', async ({ lobbyId, hostId, playerId }) => {
    try {
        const lobby = await lobbyManager.getLobby(lobbyId);
        if (lobby.host_id !== hostId) {
            throw new Error('Только хост может улучшать здоровье');
        }
        const player = lobby.players.find(p => p.id === playerId);
        if (player && player.character.health) {
            const severity = player.character.health.severity;
            const severities = ["критическая", "тяжелая", "средняя", "легкая"];
            const currentIndex = severities.indexOf(severity);
            if (currentIndex > 0) {
                player.character.health.severity = severities[currentIndex - 1];
                if (player.character.health.severity === "легкая") {
                    player.character.health.condition = "Идеально здоров";
                }
            }
            await lobbyManager.saveLobby(lobbyId, lobby);
            io.to(lobbyId).emit('lobby_state', lobby);
        }
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});

// Ухудшение здоровья
socket.on('worsen_health', async ({ lobbyId, hostId, playerId }) => {
    try {
        const lobby = await lobbyManager.getLobby(lobbyId);
        if (lobby.host_id !== hostId) {
            throw new Error('Только хост может ухудшать здоровье');
        }
        const player = lobby.players.find(p => p.id === playerId);
        if (player && player.character.health) {
            const severity = player.character.health.severity;
            const severities = ["легкая", "средняя", "тяжелая", "критическая"];
            const currentIndex = severities.indexOf(severity);
            if (currentIndex < severities.length - 1) {
                player.character.health.severity = severities[currentIndex + 1];
                if (player.character.health.severity === "критическая") {
                    player.alive = false;
                    io.to(lobbyId).emit('player_killed', { playerId });
                }
            }
            await lobbyManager.saveLobby(lobbyId, lobby);
            io.to(lobbyId).emit('lobby_state', lobby);
        }
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});

// Добавление к характеристике
socket.on('add_to_characteristic', async ({ lobbyId, hostId, playerId, field, value }) => {
    try {
        const lobby = await lobbyManager.getLobby(lobbyId);
        if (lobby.host_id !== hostId) {
            throw new Error('Только хост может изменять характеристики');
        }
        const player = lobby.players.find(p => p.id === playerId);
        if (player && player.character) {
            const currentValue = player.character[field] || '';
            player.character[field] = currentValue ? `${currentValue}, ${value}` : value;
            await lobbyManager.saveLobby(lobbyId, lobby);
            io.to(lobbyId).emit('lobby_state', lobby);
        }
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});

    // Голосование
    socket.on('start_voting', ({ lobbyId, duration = 15 }) => {
        io.to(lobbyId).emit('voting_started', { duration });
    });

    socket.on('end_voting', ({ lobbyId }) => {
        io.to(lobbyId).emit('voting_ended');
    });

    socket.on('vote', ({ lobbyId, voterId, targetId }) => {
        io.to(lobbyId).emit('vote_cast', { voterId, targetId });
    });

    // Отключение
    socket.on('disconnect', async () => {
        console.log('❌ Client disconnected:', socket.id);
        
        try {
            // Ищем игрока с этим socketId
            const files = await fs.readdir(path.join(__dirname, 'data'));
            
            for (const file of files) {
                if (file.startsWith('lobby_')) {
                    const filePath = path.join(__dirname, 'data', file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const lobby = JSON.parse(data);
                    
                    const player = lobby.players.find(p => p.socketId === socket.id);
                    if (player) {
                        player.online = false;
                        player.socketId = null;
                        await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
                        io.to(lobby.id).emit('lobby_state', lobby);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    });
});

// Запуск сервера
async function start() {
    try {
        // Создаем папку data
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir);
        }

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📡 WebSocket server ready`);
        });
    } catch (error) {
        console.error('Failed to start:', error);
    }
}


// В server.js после создания папки data
async function repairCorruptedLobbies() {
    const dataDir = path.join(__dirname, 'data');
    try {
        const files = await fs.readdir(dataDir);
        let repaired = 0;
        
        for (const file of files) {
            if (file.startsWith('lobby_') && file.endsWith('.json')) {
                const filePath = path.join(dataDir, file);
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    JSON.parse(data); // Проверяем валидность
                } catch (e) {
                    console.log(`🔧 Repairing corrupted file: ${file}`);
                    
                    // Пытаемся восстановить
                    const cleanData = data
                        .replace(/^\uFEFF/, '')
                        .replace(/\0/g, '')
                        .replace(/[^\x20-\x7E\n\r\t{}[\]:,"]+/g, '')
                        .trim();
                    
                    const lastBrace = cleanData.lastIndexOf('}');
                    if (lastBrace > 0) {
                        const fixed = cleanData.substring(0, lastBrace + 1);
                        try {
                            JSON.parse(fixed);
                            await fs.writeFile(filePath, fixed, 'utf8');
                            repaired++;
                            console.log(`✅ Repaired: ${file}`);
                        } catch (parseError) {
                            // Если не получается восстановить, удаляем
                            const backupPath = filePath + '.corrupted.' + Date.now();
                            await fs.rename(filePath, backupPath);
                            console.log(`🗑️ Moved corrupted file to backup: ${path.basename(backupPath)}`);
                        }
                    }
                }
            }
        }
        
        if (repaired > 0) {
            console.log(`🔧 Repaired ${repaired} corrupted lobby files`);
        }
    } catch (error) {
        console.error('Error repairing lobbies:', error);
    }
}

// Вызовите после создания папки data
await repairCorruptedLobbies();

start();