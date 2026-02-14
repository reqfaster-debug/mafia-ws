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
        let data = await fs.readFile(filePath, 'utf8');
        
        // Агрессивная очистка данных
        data = data
            .replace(/^\uFEFF/, '')           // Удаляем BOM
            .replace(/\0/g, '')                // Удаляем нулевые байты
            .replace(/[^\x20-\x7E\n\r\t{}[\]:,"]+/g, '') // Удаляем не-ASCII
            .trim();
        
        // Находим последнюю закрывающую скобку
        const lastBrace = data.lastIndexOf('}');
        if (lastBrace === -1) {
            throw new Error('No valid JSON object found');
        }
        
        // Берём только валидную часть
        const validJson = data.substring(0, lastBrace + 1);
        
        // Парсим
        const lobby = JSON.parse(validJson);
        
        // Если были лишние символы, перезаписываем файл
        if (validJson !== data) {
            await fs.writeFile(filePath, validJson, 'utf8');
            console.log(`🧹 Cleaned up lobby file on read: ${lobbyId}`);
        }
        
        return lobby;
        
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
            
            const lastBrace = cleanBackup.lastIndexOf('}');
            if (lastBrace > 0) {
                const validBackup = cleanBackup.substring(0, lastBrace + 1);
                const lobby = JSON.parse(validBackup);
                await fs.writeFile(filePath, validBackup, 'utf8');
                console.log(`🔄 Restored from backup: ${lobbyId}`);
                return lobby;
            }
        } catch (backupError) {
            console.error(`❌ Backup also corrupted: ${lobbyId}`);
        }
        
        // Создаём новое лобби
        console.log(`🆕 Creating new lobby: ${lobbyId}`);
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
        
        // Записываем файл
        await fs.writeFile(filePath, data, 'utf8');
        
        // ✅ ИСПРАВЛЕНИЕ: Читаем только что записанный файл
        const written = await fs.readFile(filePath, 'utf8');
        
        // Очищаем от возможных лишних символов
        const cleanData = written
            .replace(/^\uFEFF/, '')           // Удаляем BOM
            .replace(/\0/g, '')                // Удаляем нулевые байты
            .trim();
        
        // Находим последнюю закрывающую скобку
        const lastBrace = cleanData.lastIndexOf('}');
        if (lastBrace === -1) {
            throw new Error('No closing brace found');
        }
        
        // Берём только валидную часть до последней скобки
        const validJson = cleanData.substring(0, lastBrace + 1);
        
        // Проверяем, что это валидный JSON
        JSON.parse(validJson);
        
        // Если всё ок, перезаписываем файл очищенными данными
        if (validJson !== written) {
            await fs.writeFile(filePath, validJson, 'utf8');
            console.log(`🧹 Cleaned up JSON file: ${lobbyId}`);
        }
        
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
            const cleanBackup = backupData
                .replace(/^\uFEFF/, '')
                .replace(/\0/g, '')
                .trim();
            
            const lastBrace = cleanBackup.lastIndexOf('}');
            if (lastBrace > 0) {
                const validBackup = cleanBackup.substring(0, lastBrace + 1);
                await fs.writeFile(filePath, validBackup, 'utf8');
                console.log(`🔄 Restored from backup: ${lobbyId}`);
            } else {
                throw new Error('Invalid backup');
            }
        } catch (restoreError) {
            console.error(`❌ Cannot restore lobby ${lobbyId}:`, restoreError);
            
            // Если ничего не помогло, создаём новое лобби
            const newLobby = {
                id: lobbyId,
                host_id: lobby.host_id || null,
                status: 'waiting',
                players: lobby.players || [],
                gameData: lobby.gameData || null,
                createdAt: lobby.createdAt || new Date().toISOString()
            };
            
            await fs.writeFile(filePath, JSON.stringify(newLobby, null, 2), 'utf8');
            console.log(`🆕 Created new lobby file: ${lobbyId}`);
        }
        
        throw new Error('Failed to save lobby');
    }
}

async startGame(lobbyId, gameDataFromClient) {
    console.log(`🎮 LobbyManager.startGame: ${lobbyId}`);
    console.log('🔥 playersData received:', JSON.stringify(gameDataFromClient.playersData, null, 2));
    
    const lobby = await this.getLobby(lobbyId);
    
    if (lobby.players.length < 6) {
        throw new Error('Нужно минимум 6 игроков для старта');
    }
    
    console.log(`👥 Generating characters for ${lobby.players.length} players...`);
    
    // Генерируем персонажей
    for (const player of lobby.players) {
        const character = gameGenerator.generateCharacter(gameDataFromClient.playersData);
        
        // ВАЖНО: Проверяем и заполняем пустые поля
        if (!character.gender || character.gender.trim() === '') {
            character.gender = ["Мужской", "Женский"][Math.floor(Math.random() * 2)];
        }
        if (!character.body_type || character.body_type.trim() === '') {
            character.body_type = ["Худощавое", "Атлетическое", "Среднее", "Плотное"][Math.floor(Math.random() * 4)];
        }
        if (!character.trait || character.trait.trim() === '') {
            character.trait = ["Храбрый", "Трусливый", "Добрый", "Злой", "Хитрый"][Math.floor(Math.random() * 5)];
        }
        if (!character.profession || !character.profession.name) {
            character.profession = {
                name: ["Врач", "Инженер", "Учитель", "Строитель", "Военный"][Math.floor(Math.random() * 5)],
                experience: Math.floor(Math.random() * 20) + 1
            };
        }
        if (!character.hobby || character.hobby.trim() === '') {
            character.hobby = ["Рыбалка", "Охота", "Чтение", "Спорт", "Музыка"][Math.floor(Math.random() * 5)];
        }
        if (!character.health || !character.health.condition) {
            character.health = {
                condition: ["Здоров", "Диабет", "Астма", "Гипертония"][Math.floor(Math.random() * 4)],
                severity: ["легкая", "средняя", "тяжелая"][Math.floor(Math.random() * 3)]
            };
        }
        if (!character.inventory || character.inventory.trim() === '') {
            character.inventory = ["Аптечка", "Нож", "Фонарик", "Веревка", "Спички"][Math.floor(Math.random() * 5)];
        }
        if (!character.phobia || character.phobia.trim() === '') {
            character.phobia = ["Клаустрофобия", "Арахнофобия", "Акрофобия", "Нет фобий"][Math.floor(Math.random() * 4)];
        }
        if (!character.extra || character.extra.trim() === '') {
            character.extra = ["Водительские права", "Знание языков", "Навыки выживания"][Math.floor(Math.random() * 3)];
        }
        
        player.character = character;
        player.revealedCharacteristics = [];
        console.log(`✅ Generated character for ${player.nickname}:`, {
            age: character.age,
            gender: character.gender,
            body_type: character.body_type,
            trait: character.trait,
            profession: character.profession.name,
            hobby: character.hobby,
            health: character.health.condition,
            inventory: character.inventory,
            phobia: character.phobia,
            extra: character.extra
        });
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
    console.log(`📊 First player example:`, lobby.players[0].character);
    
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
// В lobbyManager.js
async revealCharacteristic(lobbyId, playerId, field) {
    try {
        console.log(`🔓 LobbyManager.revealCharacteristic: ${lobbyId}, ${playerId}, ${field}`);
        
        // Получаем лобби
        const lobby = await this.getLobby(lobbyId);
        
        // Находим игрока
        const player = lobby.players.find(p => p.id === playerId);
        
        if (!player) {
            throw new Error('Player not found');
        }
        
        // Инициализируем массив если его нет
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        
        // Добавляем характеристику если её ещё нет
        if (!player.revealedCharacteristics.includes(field)) {
            player.revealedCharacteristics.push(field);
            
            // Сохраняем лобби
            await this.saveLobby(lobbyId, lobby);
            
            console.log(`✅ LobbyManager: Characteristic saved for ${player.nickname}:`, player.revealedCharacteristics);
        } else {
            console.log(`ℹ️ Characteristic already revealed: ${field}`);
        }
        
        return lobby;
    } catch (error) {
        console.error(`❌ LobbyManager.revealCharacteristic error:`, error);
        throw error;
    }
}
}

module.exports = new LobbyManager();