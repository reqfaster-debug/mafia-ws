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
                    revealedCharacteristics: [],
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
        
        // Очищаем данные от любых проблемных символов
        let cleanData = data
            .replace(/^\uFEFF/, '')           // Удаляем BOM
            .replace(/\0/g, '')                // Удаляем нулевые байты
            .replace(/[^\x20-\x7E\n\r\t{}[\]:,"]+/g, '') // Удаляем не-ASCII символы кроме нужных
            .trim();
        
        // Находим последнюю закрывающую скобку и обрезаем всё после неё
        const lastBrace = cleanData.lastIndexOf('}');
        if (lastBrace > 0) {
            cleanData = cleanData.substring(0, lastBrace + 1);
        }
        
        // Проверяем, что это валидный JSON
        try {
            return JSON.parse(cleanData);
        } catch (parseError) {
            console.error(`❌ JSON parse error for ${lobbyId}, attempting recovery...`);
            
            // Если не получилось, пробуем найти валидную часть
            const match = cleanData.match(/\{.*\}/s);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error('Cannot recover lobby data');
        }
        
    } catch (error) {
        console.error(`❌ Error reading lobby ${lobbyId}:`, error.message);
        
        // Пытаемся восстановить из бэкапа
        const backupPath = filePath + '.bak';
        try {
            const backupData = await fs.readFile(backupPath, 'utf8');
            const cleanBackup = backupData
                .replace(/^\uFEFF/, '')
                .replace(/\0/g, '')
                .trim();
            
            console.log(`🔄 Restored from backup: ${lobbyId}`);
            return JSON.parse(cleanBackup);
            
        } catch (backupError) {
            // Создаём новый файл если ничего не помогло
            console.log(`🆕 Creating new lobby file for ${lobbyId}`);
            const newLobby = {
                id: lobbyId,
                host_id: null,
                status: 'waiting',
                players: [],
                gameData: null,
                createdAt: new Date().toISOString()
            };
            await this.saveLobby(lobbyId, newLobby);
            return newLobby;
        }
    }
}

async saveLobby(lobbyId, lobby) {
    const filePath = path.join(__dirname, '..', 'data', `lobby_${lobbyId}.json`);
    const backupPath = filePath + '.bak';
    
    try {
        // Создаём резервную копию если основной файл существует
        try {
            const existing = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, existing);
        } catch (e) {
            // Файла нет - игнорируем
        }
        
        // Записываем новый файл
        const data = JSON.stringify(lobby, null, 2);
        
        // Проверяем, что данные валидны
        JSON.parse(data); // Бросит ошибку если невалидно
        
        await fs.writeFile(filePath, data, 'utf8');
        
        // Проверяем, что записалось корректно
        const written = await fs.readFile(filePath, 'utf8');
        JSON.parse(written);
        
        console.log(`💾 Lobby saved: ${lobbyId}`);
        
        // Удаляем старый бэкап если всё хорошо
        try { 
            await fs.unlink(backupPath); 
        } catch (e) {}
        
    } catch (error) {
        console.error(`❌ Error saving lobby ${lobbyId}:`, error);
        
        // Пытаемся восстановить из бэкапа
        try {
            const backupData = await fs.readFile(backupPath, 'utf8');
            await fs.writeFile(filePath, backupData, 'utf8');
            console.log(`🔄 Restored from backup after failed save: ${lobbyId}`);
        } catch (restoreError) {
            console.error(`❌ Cannot restore lobby ${lobbyId}`);
        }
        
        throw new Error('Failed to save lobby');
    }
}

  async startGame(lobbyId, gameDataFromClient) {
    console.log(`🎮 LobbyManager.startGame: ${lobbyId}`);
    console.log('🔥 playersData:', gameDataFromClient.playersData);
    
    const lobby = await this.getLobby(lobbyId);
    
    if (lobby.players.length < 6) {
        throw new Error('Нужно минимум 6 игроков для старта');
    }
    
    // Генерируем персонажей
    for (const player of lobby.players) {
        player.character = gameGenerator.generateCharacter(gameDataFromClient.playersData);
        player.revealedCharacteristics = [];
        console.log(`✅ Generated character for ${player.nickname}:`, player.character);
    }
    
    // Проверяем пол
    await this.validateGenders(lobby.players);
    
    // Места в бункере
    const bunkerSpaces = Math.floor(lobby.players.length * 0.5);
    
    // Данные игры
    const randomCatIndex = Math.floor(Math.random() * gameDataFromClient.catastrophes.length);
    const randomBunkerIndex = Math.floor(Math.random() * gameDataFromClient.bunkers.length);
    
    const catastrophe = gameDataFromClient.catastrophes[randomCatIndex];
    const bunker = gameDataFromClient.bunkers[randomBunkerIndex];
    
    lobby.gameData = {
        catastrophe: catastrophe,
        bunker: {
            ...bunker,
            spaces: bunkerSpaces
        }
    };
    
    lobby.status = 'playing';
    
    await this.saveLobby(lobbyId, lobby);
    console.log(`✅ Game started in ${lobbyId}`);
    
    return lobby;
}

    async validateGenders(players) {
        const genders = players.map(p => p.character.gender);
        
        if (!genders.includes("Мужской")) {
            const randomPlayer = players.find(p => p.character.gender !== "Женский");
            if (randomPlayer) randomPlayer.character.gender = "Мужской";
        }
        
        if (!genders.includes("Женский")) {
            const randomPlayer = players.find(p => p.character.gender !== "Мужской");
            if (randomPlayer) randomPlayer.character.gender = "Женский";
        }
        
        const transformerCount = genders.filter(g => g === "Трансформер").length;
        if (transformerCount > 1) {
            const transformerPlayers = players.filter(p => p.character.gender === "Трансформер");
            for (let i = 1; i < transformerPlayers.length; i++) {
                transformerPlayers[i].character.gender = Math.random() > 0.5 ? "Мужской" : "Женский";
            }
        }
    }

async revealCharacteristic(lobbyId, playerId, field) {
    try {
        console.log(`🔓 Reveal characteristic request: ${lobbyId}, ${playerId}, ${field}`);
        const lobby = await this.getLobby(lobbyId);
        const player = lobby.players.find(p => p.id === playerId);
        
        if (player) {
            console.log(`Found player: ${player.nickname}`);
            console.log(`Current revealedCharacteristics:`, player.revealedCharacteristics);
            
            if (!player.revealedCharacteristics) {
                player.revealedCharacteristics = [];
            }
            if (!player.revealedCharacteristics.includes(field)) {
                player.revealedCharacteristics.push(field);
                await this.saveLobby(lobbyId, lobby);
                console.log(`🔓 Characteristic revealed: ${playerId}.${field}`);
                console.log(`Updated revealedCharacteristics:`, player.revealedCharacteristics);
            } else {
                console.log(`Characteristic already revealed`);
            }
        } else {
            console.log(`Player not found: ${playerId}`);
        }
        return lobby;
    } catch (error) {
        console.error(`❌ Error revealing characteristic:`, error);
        throw error;
    }
}
}

module.exports = new LobbyManager();