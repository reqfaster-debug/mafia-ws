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

        return { lobbyId, hostId };
    }

    async getLobby(lobbyId) {
        const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            throw new Error('Lobby not found');
        }
    }

    async joinLobby(lobbyId, playerId, nickname, socketId) {
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.status !== 'waiting') {
            throw new Error('Game already started');
        }

        let player = lobby.players.find(p => p.id === playerId);
        
        if (player) {
            player.online = true;
            player.socketId = socketId;
        } else {
            player = {
                id: uuidv4(),
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
                    player.online = false;
                    player.socketId = null;
                    await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
                    break;
                }
            }
        }
    }

    async startGame(lobbyId, gameDataFromClient) {
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.players.length < 6) {
            throw new Error('Need at least 6 players to start');
        }

        // Generate characters for all players
        for (const player of lobby.players) {
            player.character = gameGenerator.generateCharacter(gameDataFromClient.playersData);
        }

        // Check gender requirements
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

        // Generate game data
        lobby.gameData = gameGenerator.generateGameData(
            gameDataFromClient.catastrophes,
            gameDataFromClient.bunkers
        );
        lobby.status = 'playing';

        await this.saveLobby(lobbyId, lobby);
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

    async kickPlayer(lobbyId, hostId, playerId) {
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.host_id !== hostId) {
            throw new Error('Only host can kick players');
        }

        lobby.players = lobby.players.filter(p => p.id !== playerId);
        await this.saveLobby(lobbyId, lobby);
    }

    async setPlayerDead(lobbyId, hostId, playerId) {
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.host_id !== hostId) {
            throw new Error('Only host can set player dead');
        }

        const player = lobby.players.find(p => p.id === playerId);
        if (player) {
            player.alive = false;
            await this.saveLobby(lobbyId, lobby);
        }
    }

    async transferHost(lobbyId, currentHostId, newHostId) {
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.host_id !== currentHostId) {
            throw new Error('Only current host can transfer host rights');
        }

        const newHost = lobby.players.find(p => p.id === newHostId);
        if (!newHost) {
            throw new Error('New host not found');
        }

        lobby.host_id = newHostId;
        await this.saveLobby(lobbyId, lobby);
    }

    async updateCharacter(lobbyId, hostId, playerId, updates) {
        const lobby = await this.getLobby(lobbyId);
        
        if (lobby.host_id !== hostId) {
            throw new Error('Only host can update characters');
        }

        const player = lobby.players.find(p => p.id === playerId);
        if (player) {
            player.character = { ...player.character, ...updates };
            
            if (updates.health === "Критическое") {
                player.alive = false;
            }
            
            await this.saveLobby(lobbyId, lobby);
        }
    }

    async saveLobby(lobbyId, lobby) {
        const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
        await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
    }
}

module.exports = new LobbyManager();