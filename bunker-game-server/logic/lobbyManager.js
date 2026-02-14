const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

        await this.saveLobby(lobbyId, lobby);
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

    async saveLobby(lobbyId, lobby) {
        const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
        await fs.writeFile(filePath, JSON.stringify(lobby, null, 2));
        console.log(`💾 Lobby saved: ${lobbyId}`);
    }
}

module.exports = new LobbyManager();