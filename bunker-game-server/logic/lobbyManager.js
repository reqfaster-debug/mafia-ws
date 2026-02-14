const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const gameGenerator = require('./gameGenerator');

class LobbyManager {
    async createLobby(hostNickname) {
        const lobbyId = uuidv4();
        const hostId = uuidv4();
        
        const lobby = {
            id: lobbyId,
            host_id: hostId,
            status: 'waiting',
            players: [
                {
                    id: hostId,
                    nickname: hostNickname,
                    online: true,
                    socketId: null,
                    revealed: false,
                    alive: true,
                    character: {}
                }
            ],
            gameData: null,
            createdAt: new Date().toISOString()
        };

        const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
        await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
        console.log(`💾 Lobby saved: ${filePath}`);

        return { lobbyId, hostId };
    }

    async getLobby(lobbyId) {
        const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Lobby not found: ${lobbyId}`);
            throw new Error('Lobby not found');
        }
    }

    async joinLobby(lobbyId, playerId, nickname, socketId) {
        console.log(`📥 Joining lobby ${lobbyId}, player: ${playerId}, nickname: ${nickname}`);
        
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.status !== 'waiting') {
            throw new Error('Game already started');
        }

        // Валидация ника
        if (!nickname || nickname.length > 20) {
            throw new Error('Ник должен быть от 1 до 20 символов');
        }

        let player = lobby.players.find(p => p.id === playerId);
        
        if (player) {
            // Reconnecting player - обновляем ник если он изменился
            console.log(`🔄 Player reconnecting: ${player.nickname}`);
            player.online = true;
            player.socketId = socketId;
            if (nickname && nickname !== player.nickname) {
                player.nickname = nickname;
            }
        } else {
            // New player
            console.log(`🆕 New player: ${nickname}`);
            player = {
                id: playerId || uuidv4(),
                nickname,
                online: true,
                socketId,
                revealed: false,
                alive: true,
                character: {}
            };
            lobby.players.push(player);
        }

        await this.saveLobby(lobbyId, lobby);
        console.log(`✅ Player ${player.nickname} joined lobby ${lobbyId}`);
        return player;
    }

    async reconnectPlayer(lobbyId, playerId, socketId) {
        const lobby = await this.getLobby(lobbyId);
        const player = lobby.players.find(p => p.id === playerId);
        
        if (player) {
            player.online = true;
            player.socketId = socketId;
            await this.saveLobby(lobbyId, lobby);
        }
        
        return player;
    }

    async handleDisconnect(socketId) {
        const files = await fs.readdir(path.join(__dirname, '..', 'data'));
        
        for (const file of files) {
            if (file.startsWith('lobby_')) {
                const filePath = path.join(__dirname, '..', 'data', file);
                const data = await fs.readFile(filePath, 'utf8');
                const lobby = JSON.parse(data);
                
                const player = lobby.players.find(p => p.socketId === socketId);
                if (player) {
                    console.log(`📴 Player disconnected: ${player.nickname} from lobby ${lobby.id}`);
                    player.online = false;
                    player.socketId = null;
                    await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
                    break;
                }
            }
        }
    }

    async startGame(lobbyId, gameDataFromClient) {
        console.log(`🎲 Starting game in lobby ${lobbyId}`);
        
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.players.length < 6) {
            throw new Error('Need at least 6 players to start');
        }

        // Генерируем персонажей для всех игроков
        for (const player of lobby.players) {
            player.character = gameGenerator.generateCharacter(gameDataFromClient.playersData);
        }

        // Проверяем требования к полу
        const genders = lobby.players.map(p => p.character.gender);
        const maleCount = genders.filter(g => g === "Мужской").length;
        const femaleCount = genders.filter(g => g === "Женский").length;
        const transformerCount = genders.filter(g => g === "Трансформер").length;

        if (maleCount === 0) {
            const randomPlayer = lobby.players.find(p => p.character.gender !== "Женский");
            if (randomPlayer) randomPlayer.character.gender = "Мужской";
        }
        if (femaleCount === 0) {
            const randomPlayer = lobby.players.find(p => p.character.gender !== "Мужской");
            if (randomPlayer) randomPlayer.character.gender = "Женский";
        }
        if (transformerCount > 1) {
            const transformerPlayers = lobby.players.filter(p => p.character.gender === "Трансформер");
            for (let i = 1; i < transformerPlayers.length; i++) {
                transformerPlayers[i].character.gender = Math.random() > 0.5 ? "Мужской" : "Женский";
            }
        }

        // Рассчитываем количество мест в бункере (50% от текущего количества игроков, округление вниз)
        const bunkerSpaces = Math.floor(lobby.players.length * 0.5);
        
        // Генерируем данные игры с учетом мест в бункере
        lobby.gameData = gameGenerator.generateGameData(
            gameDataFromClient.catastrophes,
            gameDataFromClient.bunkers,
            bunkerSpaces
        );
        
        lobby.status = 'playing';

        await this.saveLobby(lobbyId, lobby);
        console.log(`✅ Game started in lobby ${lobbyId}`);
        
        return lobby.gameData;
    }

    async revealCharacter(lobbyId, playerId) {
        const lobby = await this.getLobby(lobbyId);
        const player = lobby.players.find(p => p.id === playerId);
        
        if (player) {
            player.revealed = true;
            await this.saveLobby(lobbyId, lobby);
        }
    }

    async saveLobby(lobbyId, lobby) {
        const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
        await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
        console.log(`💾 Lobby saved: ${lobbyId}`);
    }
}

module.exports = new LobbyManager();