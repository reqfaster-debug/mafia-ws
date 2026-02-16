const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);

// Настройка CORS
const io = socketIo(server, {
  cors: {
    origin: ["http://a1230559.xsph.ru", "http://localhost"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: ["http://a1230559.xsph.ru", "http://localhost"],
  credentials: true
}));

app.use(express.json());

// ============ ВАЖНО: Объявляем переменные ДО их использования ============
// Хранилища данных
let games = new Map();        // Активные игры
let lobbies = new Map();      // Лобби
const activePlayers = new Map(); // Активные игроки (socketId -> playerData)
let playersDataMap = new Map();  // ПОСТОЯННОЕ хранение данных игроков (playerId -> playerData)
const playerGameMap = new Map();  // Связь playerId -> gameId
// =========================================================================

// Отключаем CSP для фавиконки
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://cdn.socket.io; style-src 'self' 'unsafe-inline';");
  next();
});

// Отдаем пустую фавиконку
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Bunker Game Server is running',
    time: new Date().toISOString(),
    stats: {
      games: games.size,
      lobbies: lobbies.size,
      players: playersDataMap.size
    }
  });
});

// Пути к файлам для хранения данных
const DATA_DIR = path.join(__dirname, 'data');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const LOBBIES_FILE = path.join(DATA_DIR, 'lobbies.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

// Создаем директорию для данных, если её нет
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Ошибка создания директории:', error);
  }
}

// Загрузка данных из файлов
async function loadData() {
  try {
    await ensureDataDir();

    // Загружаем игры
    try {
      const gamesData = await fs.readFile(GAMES_FILE, 'utf8');
      games = new Map(JSON.parse(gamesData));
    } catch (error) {
      games = new Map();
    }

    // Загружаем лобби
    try {
      const lobbiesData = await fs.readFile(LOBBIES_FILE, 'utf8');
      lobbies = new Map(JSON.parse(lobbiesData));
    } catch (error) {
      lobbies = new Map();
    }

    // Загружаем игроков
    try {
      const playersData = await fs.readFile(PLAYERS_FILE, 'utf8');
      const playersArray = JSON.parse(playersData);
      playersDataMap = new Map(playersArray);
    } catch (error) {
      playersDataMap = new Map();
    }

    console.log('Данные загружены');
    console.log('Игр:', games.size);
    console.log('Лобби:', lobbies.size);
    console.log('Игроков:', playersDataMap.size);
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
  }
}

// ============ Функция расчета мест в бункере ============
function calculateBunkerSlots(playerCount) {
    return Math.floor(playerCount / 2);
}
// =======================================================

// Сохранение данных в файлы
async function saveData() {
  try {
    await ensureDataDir();

    await fs.writeFile(GAMES_FILE, JSON.stringify(Array.from(games.entries()), null, 2));
    await fs.writeFile(LOBBIES_FILE, JSON.stringify(Array.from(lobbies.entries()), null, 2));
    await fs.writeFile(PLAYERS_FILE, JSON.stringify(Array.from(playersDataMap.entries()), null, 2));

    console.log('Данные сохранены');
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
  }
}

// Загружаем данные при старте
loadData();
setInterval(saveData, 5 * 60 * 1000);

// ================= FIX: Ensure creatorId and realtime room joining =================
function emitGameUpdateFixed(gameId) {
  const game = games.get(gameId);
  if (!game) return;
  
  io.to(gameId).emit('gameUpdate', {
    players: game.players,
    creatorId: game.creator,
    disaster: game.disaster,
    bunker: game.bunker,
    totalSlots: game.totalSlots
  });
}

global.emitGameUpdate = emitGameUpdateFixed;
// ================= END FIX =================

// Массивы данных
const GAME_DATA = {
  disasters: [
    "Ядерная война. Поверхность земли превратилась в радиоактивную пустошь.",
    "Глобальная пандемия. Вирус уничтожил 90% населения.",
    "Падение астероида. Климат изменился навсегда.",
    "Извержение супервулкана. Годы вулканической зимы.",
    "Нашествие зомби. Мир погрузился в хаос.",
    "Климатическая катастрофа. Затопление большей части суши."
  ],

  bunkers: [
    {
      "duration_years": 4,
      "food_years": 3,
      "extra": "Есть система фильтрации воздуха. Имеется медицинский отсек."
    },
    {
      "duration_years": 3,
      "food_years": 2,
      "extra": "Есть запас топлива на 2 года. Работает интернет."
    },
    {
      "duration_years": 5,
      "food_years": 4,
      "extra": "Солярий и тренажерный зал. Есть библиотека."
    },
    {
      "duration_years": 2,
      "food_years": 5,
      "extra": "Большой запас еды, но проблемы с вентиляцией."
    }
  ],

  characteristics: {
    genders: ['Мужской', 'Женский'],
    bodyTypes: ['Легкое', 'Атлетичное', 'Полное', 'Сильное ожирение'],
    traits: ['Храбрый', 'Трусливый', 'Добрый', 'Злой', 'Щедрый', 'Жадный', 'Честный', 'Лживый', 'Общительный', 'Замкнутый'],
    hobbies: ['Рыбалка', 'Охота', 'Чтение', 'Спорт', 'Рисование', 'Музыка', 'Кулинария', 'Садоводство'],
    health: [
      { name: 'Здоров' },
      { name: 'Диабет' },
      { name: 'Астма' },
      { name: 'Гипертония' },
      { name: 'Аллергия' },
      { name: 'Артрит' },
      { name: 'Язва' },
      { name: 'Гепатит' },
      { name: 'Туберкулез' },
      { name: 'ВИЧ' },
      { name: 'Онкология' },
      { name: 'Псориаз' },
      { name: 'Эпилепсия' },
      { name: 'Мигрень' }
    ],
    inventory: ['Аптечка', 'Нож', 'Фонарик', 'Топор', 'Веревка', 'Спички', 'Палатка', 'Компас'],
    phobias: ['Клаустрофобия', 'Арахнофобия', 'Акрофобия', 'Социофобия', 'Агорафобия'],
    extras: ['Водительские права', 'Знание языков', 'Навыки выживания', 'Мед. образование', 'Пед. образование'],
    professions: [
      { name: 'Врач', description: 'Может лечить' },
      { name: 'Инженер', description: 'Может чинить' },
      { name: 'Военный', description: 'Охрана бункера' },
      { name: 'Учитель', description: 'Может обучать' },
      { name: 'Строитель', description: 'Может строить' },
      { name: 'Повар', description: 'Может готовить' }
    ]
  }
};

// Степени тяжести для здоровья
const HEALTH_SEVERITIES = ['легкая', 'средняя', 'тяжелая', 'критическая'];

// Функция генерации игрока
function generatePlayer(name, socketId) {
  const gender = GAME_DATA.characteristics.genders[Math.floor(Math.random() * GAME_DATA.characteristics.genders.length)];
  const age = Math.floor(Math.random() * (80 - 18 + 1)) + 18;
  const profession = GAME_DATA.characteristics.professions[Math.floor(Math.random() * GAME_DATA.characteristics.professions.length)];
  const experience = Math.floor(Math.random() * 30) + 1;
  
  const healthBase = GAME_DATA.characteristics.health[Math.floor(Math.random() * GAME_DATA.characteristics.health.length)];
  let healthValue = healthBase.name;
  
  if (healthBase.name !== 'Здоров') {
    const severity = HEALTH_SEVERITIES[Math.floor(Math.random() * HEALTH_SEVERITIES.length)];
    healthValue = `${healthBase.name} (${severity})`;
  }

  const player = {
    id: uuidv4(),
    socketId,
    name,
    characteristics: {
      gender: { value: `${gender} (${age} лет)`, revealed: false },
      bodyType: { value: GAME_DATA.characteristics.bodyTypes[Math.floor(Math.random() * GAME_DATA.characteristics.bodyTypes.length)], revealed: false },
      trait: { value: GAME_DATA.characteristics.traits[Math.floor(Math.random() * GAME_DATA.characteristics.traits.length)], revealed: false },
      profession: { value: `${profession.name} (стаж ${experience} лет) - ${profession.description}`, revealed: false },
      hobby: { value: GAME_DATA.characteristics.hobbies[Math.floor(Math.random() * GAME_DATA.characteristics.hobbies.length)], revealed: false },
      health: { value: healthValue, revealed: false },
      inventory: { value: GAME_DATA.characteristics.inventory[Math.floor(Math.random() * GAME_DATA.characteristics.inventory.length)], revealed: false },
      phobia: { value: GAME_DATA.characteristics.phobias[Math.floor(Math.random() * GAME_DATA.characteristics.phobias.length)], revealed: false },
      extra: { value: GAME_DATA.characteristics.extras[Math.floor(Math.random() * GAME_DATA.characteristics.extras.length)], revealed: false }
    }
  };

  playersDataMap.set(player.id, player);
  saveData();

  return player;
}

// ============ НОВЫЕ ФУНКЦИИ ДЛЯ ЗДОРОВЬЯ ============
function getRandomHealth() {
  const healthBase = GAME_DATA.characteristics.health[Math.floor(Math.random() * GAME_DATA.characteristics.health.length)];
  if (healthBase.name === 'Здоров') {
    return 'Здоров';
  }
  const severity = HEALTH_SEVERITIES[Math.floor(Math.random() * HEALTH_SEVERITIES.length)];
  return `${healthBase.name} (${severity})`;
}

function getRandomSeverity() {
  return HEALTH_SEVERITIES[Math.floor(Math.random() * HEALTH_SEVERITIES.length)];
}

function extractHealthName(healthString) {
  const match = healthString.match(/^([^(]+)/);
  return match ? match[1].trim() : healthString;
}
// ====================================================

// ============ НОВЫЕ ФУНКЦИИ ДЛЯ ХАРАКТЕРИСТИК ============
function getRandomValue(charKey, currentValue = null, allPlayers = null, currentPlayerId = null) {
  const charData = GAME_DATA.characteristics[charKey];
  if (!charData) return '';
  
  let newValue;
  const maxAttempts = 50; // Защита от бесконечного цикла
  let attempts = 0;
  
  if (charKey === 'profession') {
    do {
      const prof = charData[Math.floor(Math.random() * charData.length)];
      const experience = Math.floor(Math.random() * 30) + 1;
      newValue = `${prof.name} (стаж ${experience} лет) - ${prof.description}`;
      attempts++;
    } while (newValue === currentValue && attempts < maxAttempts);
    return newValue;
  }
  
  if (charKey === 'gender') {
    do {
      const gender = charData[Math.floor(Math.random() * charData.length)];
      const age = Math.floor(Math.random() * (80 - 18 + 1)) + 18;
      newValue = `${gender} (${age} лет)`;
      attempts++;
    } while (newValue === currentValue && attempts < maxAttempts);
    return newValue;
  }
  
  // Для обычных массивов
  do {
    newValue = charData[Math.floor(Math.random() * charData.length)];
    attempts++;
  } while (newValue === currentValue && attempts < maxAttempts);
  
  return newValue;
}

function parseCharacteristicValue(charKey, value) {
  if (charKey === 'profession' || charKey === 'gender') {
    return { main: value, items: [] };
  }
  
  if (value && value.includes(',')) {
    const items = value.split(',').map(s => s.trim());
    return { main: items[0], items: items.slice(1) };
  }
  
  return { main: value, items: [] };
}

function formatCharacteristicValue(charKey, mainValue, additionalItems = []) {
  if (charKey === 'profession' || charKey === 'gender') {
    return mainValue;
  }
  
  if (additionalItems.length > 0) {
    return [mainValue, ...additionalItems].join(', ');
  }
  
  return mainValue;
}
// =========================================================

// API маршруты
app.post('/api/create-lobby', (req, res) => {
  try {
    const lobbyId = uuidv4().substring(0, 6).toUpperCase();
    lobbies.set(lobbyId, {
      id: lobbyId,
      players: [],
      creator: null,
      created: Date.now()
    });

    saveData();
    console.log('Лобби создано:', lobbyId);
    res.json({ lobbyId });
  } catch (error) {
    console.error('Ошибка создания лобби:', error);
    res.status(500).json({ error: 'Ошибка создания лобби' });
  }
});

app.get('/api/check-lobby/:lobbyId', (req, res) => {
  try {
    const { lobbyId } = req.params;
    const lobby = lobbies.get(lobbyId);
    res.json({ exists: !!lobby });
  } catch (error) {
    console.error('Ошибка проверки лобби:', error);
    res.status(500).json({ error: 'Ошибка проверки лобби' });
  }
});

app.get('/api/check-player/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;

    const gameId = playerGameMap.get(playerId);
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        const player = game.players.find(p => p.id === playerId);
        if (player) {
          return res.json({
            active: true,
            type: 'game',
            gameId: gameId,
            lobbyId: game.lobbyId,
            player: player,
            gameData: {
              disaster: game.disaster,
              bunker: game.bunker,
              players: game.players
            }
          });
        }
      }
    }

    for (const [lId, lobby] of lobbies) {
      const player = lobby.players.find(p => p.id === playerId);
      if (player) {
        return res.json({
          active: true,
          type: lobby.gameId ? 'game_started' : 'lobby',
          gameId: lobby.gameId,
          lobbyId: lId,
          player: player,
          players: lobby.players
        });
      }
    }

    const savedPlayer = playersDataMap.get(playerId);
    if (savedPlayer) {
      return res.json({
        active: false,
        saved: true,
        player: savedPlayer
      });
    }

    res.json({ active: false });

  } catch (error) {
    console.error('Ошибка проверки игрока:', error);
    res.status(500).json({ error: 'Ошибка проверки игрока' });
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('joinGameRoomFixed', (gameId) => {
    socket.join(gameId);
    console.log(`Сокет ${socket.id} присоединился к комнате игры ${gameId}`);
  });

  socket.on('reconnectPlayer', ({ playerId }) => {
    console.log('Попытка восстановления игрока:', playerId);

    const existingSocket = [...activePlayers.entries()].find(([sid, p]) => p.id === playerId);
    if (existingSocket) {
      console.log('Игрок уже активен, отключаем старый socket');
      const [oldSocketId] = existingSocket;
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.disconnect();
      }
      activePlayers.delete(oldSocketId);
    }

    const gameId = playerGameMap.get(playerId);
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        const player = game.players.find(p => p.id === playerId);
        if (player) {
          player.socketId = socket.id;
          activePlayers.set(socket.id, player);
          socket.join(gameId);

          socket.emit('reconnectSuccess', {
            type: 'game',
            gameId: gameId,
            disaster: game.disaster,
            bunker: game.bunker,
            totalSlots: game.totalSlots,
            player: player,
            players: game.players,
            creatorId: game.creator
          });

          console.log('Игрок восстановлен в игре:', player.name);
          return;
        }
      }
    }

    for (const [lId, lobby] of lobbies) {
      const player = lobby.players.find(p => p.id === playerId);
      if (player) {
        player.socketId = socket.id;
        activePlayers.set(socket.id, player);
        socket.join(lId);

        if (lobby.gameId) {
          const game = games.get(lobby.gameId);
          if (game) {
            socket.emit('reconnectSuccess', {
              type: 'game',
              gameId: lobby.gameId,
              disaster: game.disaster,
              bunker: game.bunker,
              player: player,
              players: game.players,
              creatorId: game.creator
            });
            
            console.log('Игрок восстановлен в игре (через лобби):', player.name);
            return;
          }
        }

        socket.emit('reconnectSuccess', {
          type: 'lobby',
          lobbyId: lId,
          player: player,
          players: lobby.players
        });

        io.to(lId).emit('lobbyUpdate', { players: lobby.players });

        console.log('Игрок восстановлен в лобби:', player.name);
        return;
      }
    }

    socket.emit('reconnectFailed', { message: 'Игрок не найден' });
  });

  socket.on('checkPlayerActive', ({ playerId }) => {
    const isActive = [...activePlayers.values()].some(p => p.id === playerId);
    socket.emit('playerActiveCheck', { active: isActive });
  });

  socket.on('joinLobby', ({ lobbyId, playerName, isCreator }) => {
    console.log('Попытка входа в лобби:', lobbyId, playerName, 'isCreator:', isCreator);

    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Лобби не найдено');
      return;
    }

    const existingPlayer = lobby.players.find(p => p.name === playerName);

    if (existingPlayer) {
      console.log('Игрок уже существует, обновляем соединение:', playerName);

      existingPlayer.socketId = socket.id;
      activePlayers.set(socket.id, existingPlayer);
      socket.join(lobbyId);

      if (lobby.gameId) {
        console.log('Игра уже началась, отправляем игрока сразу в игру');
        
        const game = games.get(lobby.gameId);
        if (game) {
          socket.emit('gameStarted', {
            gameId: game.id,
            disaster: game.disaster,
            bunker: game.bunker,
            player: existingPlayer,
            players: game.players,
            creatorId: game.creator
          });
        } else {
          socket.emit('joinedLobby', { lobbyId, player: existingPlayer, isCreator: lobby.creator === existingPlayer.id });
          io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players, creatorId: lobby.creator });
        }
      } else {
        socket.emit('joinedLobby', { lobbyId, player: existingPlayer, isCreator: lobby.creator === existingPlayer.id });
        io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players, creatorId: lobby.creator });
      }

      return;
    }

    const player = generatePlayer(playerName, socket.id);
    lobby.players.push(player);
    activePlayers.set(socket.id, player);

    if (isCreator || lobby.players.length === 1) {
      lobby.creator = player.id;
      console.log('Назначен создатель лобби:', player.name);
    }

    socket.join(lobbyId);
    socket.emit('joinedLobby', { lobbyId, player, isCreator: lobby.creator === player.id });
    io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players, creatorId: lobby.creator });

    saveData();
    console.log('Новый игрок присоединился:', playerName);
  });

  socket.on('startGame', ({ lobbyId }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Лобби не найдено');
      return;
    }

    const player = lobby.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Игрок не найден в лобби');
      return;
    }

    if (player.id !== lobby.creator) {
      socket.emit('error', 'Только создатель лобби может начать игру');
      return;
    }

    if (lobby.players.length < 4) {
      socket.emit('error', 'Недостаточно игроков (нужно минимум 4)');
      return;
    }

    const gameId = uuidv4();
    const game = {
      id: gameId,
      disaster: GAME_DATA.disasters[Math.floor(Math.random() * GAME_DATA.disasters.length)],
      bunker: GAME_DATA.bunkers[Math.floor(Math.random() * GAME_DATA.bunkers.length)],
      players: lobby.players,
      status: 'active',
      created: Date.now(),
      lobbyId: lobbyId,
      creator: lobby.creator,
      totalSlots: calculateBunkerSlots(lobby.players.length)
    };

    games.set(gameId, game);
    lobby.status = 'game_started';
    lobby.gameId = gameId;

    game.players.forEach(player => {
      playerGameMap.set(player.id, gameId);
    });

    game.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.join(gameId);
      }

      io.to(player.socketId).emit('gameStarted', {
        gameId: game.id,
        disaster: game.disaster,
        bunker: game.bunker,
        totalSlots: game.totalSlots,
        player: player,
        players: game.players,
        isCreator: player.id === lobby.creator,
        creatorId: game.creator
      });
    });

    saveData();
    console.log('Игра создана:', gameId);
  });

  socket.on('getGameData', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;

    socket.emit('gameData', {
      gameId: game.id,
      disaster: game.disaster,
      bunker: game.bunker,
      totalSlots: game.totalSlots,
      player: player,
      players: game.players,
      isCreator: player.id === game.creator,
      creatorId: game.creator
    });
  });

  socket.on('revealCharacteristic', ({ gameId, characteristic }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;

    player.characteristics[characteristic].revealed = true;

    const savedPlayer = playersDataMap.get(player.id);
    if (savedPlayer) {
      savedPlayer.characteristics[characteristic].revealed = true;
    }

    game.players.forEach(p => {
      io.to(p.socketId).emit('characteristicRevealed', {
        playerId: player.id,
        characteristic,
        value: player.characteristics[characteristic].value,
        revealedBy: player.name
      });
    });

    saveData();
  });

  socket.on('kickPlayer', ({ gameId, playerIdToKick }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const initiator = game.players.find(p => p.socketId === socket.id);
    if (!initiator || initiator.id !== game.creator) {
      socket.emit('error', 'Только создатель может изгонять игроков');
      return;
    }

    // Разрешаем изгнать себя - убрана проверка

    const playerToKick = game.players.find(p => p.id === playerIdToKick);
    if (!playerToKick) {
      socket.emit('error', 'Игрок не найден');
      return;
    }

    playerToKick.status = 'kicked';
    playerToKick.statusMessage = 'изгнан';

    games.set(gameId, game);
    emitGameUpdateFixed(gameId);
    saveData();
    console.log(`В игре ${gameId} игрок ${playerToKick.name} изгнан создателем ${initiator.name}`);
  });

  socket.on('markDead', ({ gameId, playerIdToMark }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const initiator = game.players.find(p => p.socketId === socket.id);
    if (!initiator || initiator.id !== game.creator) {
      socket.emit('error', 'Только создатель может отмечать игроков мертвыми');
      return;
    }

    // Разрешаем отметить себя мертвым - убрана проверка

    const playerToMark = game.players.find(p => p.id === playerIdToMark);
    if (!playerToMark) {
      socket.emit('error', 'Игрок не найден');
      return;
    }

    playerToMark.status = 'dead';
    playerToMark.statusMessage = 'мертв';

    games.set(gameId, game);
    emitGameUpdateFixed(gameId);
    saveData();
    console.log(`В игре ${gameId} игрок ${playerToMark.name} отмечен мертвым создателем ${initiator.name}`);
  });

  socket.on('restorePlayer', ({ gameId, playerIdToRestore }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const initiator = game.players.find(p => p.socketId === socket.id);
    if (!initiator || initiator.id !== game.creator) {
      socket.emit('error', 'Только создатель может восстанавливать игроков');
      return;
    }

    const playerToRestore = game.players.find(p => p.id === playerIdToRestore);
    if (!playerToRestore) {
      socket.emit('error', 'Игрок не найден');
      return;
    }

    delete playerToRestore.status;
    delete playerToRestore.statusMessage;

    games.set(gameId, game);
    emitGameUpdateFixed(gameId);
    saveData();
    console.log(`В игре ${gameId} игрок ${playerToRestore.name} восстановлен создателем ${initiator.name}`);
  });

  socket.on('transferCreator', ({ gameId, newCreatorId }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const initiator = game.players.find(p => p.socketId === socket.id);
    if (!initiator || initiator.id !== game.creator) {
      socket.emit('error', 'Только создатель может передавать права');
      return;
    }

    const newCreator = game.players.find(p => p.id === newCreatorId);
    if (!newCreator) {
      socket.emit('error', 'Игрок не найден');
      return;
    }

    game.creator = newCreatorId;

    games.set(gameId, game);
    emitGameUpdateFixed(gameId);
    io.to(newCreator.socketId).emit('youAreNowCreator');

    saveData();
    console.log(`В игре ${gameId} права создателя переданы от ${initiator.name} к ${newCreator.name}`);
  });

  // ============ НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ЗДОРОВЬЯ ============
  socket.on('changeHealth', ({ gameId, playerId, action, diseaseName, severity }) => {
    console.log('changeHealth called:', { gameId, playerId, action, diseaseName, severity });
    
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const initiator = game.players.find(p => p.socketId === socket.id);
    if (!initiator || initiator.id !== game.creator) {
      socket.emit('error', 'Только создатель может изменять здоровье');
      return;
    }

    const targetPlayer = game.players.find(p => p.id === playerId);
    if (!targetPlayer) {
      socket.emit('error', 'Игрок не найден');
      return;
    }

    let newHealthValue;

    switch (action) {
      case 'random':
        newHealthValue = getRandomHealth();
        break;
      
      case 'select':
        if (!diseaseName) {
          socket.emit('error', 'Не выбрана болезнь');
          return;
        }
        if (diseaseName === 'Здоров') {
          newHealthValue = 'Здоров';
        } else {
          const sev = severity || getRandomSeverity();
          newHealthValue = `${diseaseName} (${sev})`;
        }
        break;
      
      case 'add':
        if (!diseaseName) {
          socket.emit('error', 'Не выбрана болезнь');
          return;
        }
        
        const currentHealth = targetPlayer.characteristics.health.value;
        let diseases = [];
        
        if (currentHealth && currentHealth !== 'Здоров') {
          const parts = currentHealth.split(',').map(s => s.trim());
          for (const part of parts) {
            const match = part.match(/^(.+?)\s*\((\w+)\)$/);
            if (match) {
              diseases.push({
                name: match[1].trim(),
                severity: match[2]
              });
            } else if (part !== 'Здоров') {
              diseases.push({
                name: part,
                severity: 'легкая'
              });
            }
          }
        }
        
        diseases.push({
          name: diseaseName,
          severity: severity || getRandomSeverity()
        });
        
        newHealthValue = diseases.map(d => `${d.name} (${d.severity})`).join(', ');
        break;
      
      default:
        socket.emit('error', 'Неизвестное действие');
        return;
    }

    targetPlayer.characteristics.health.value = newHealthValue;

    games.set(gameId, game);
    emitGameUpdateFixed(gameId);
    saveData();
    
    console.log(`Создатель изменил здоровье игрока ${targetPlayer.name} на ${newHealthValue}`);
  });
  // ====================================================

  // ============ НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ХАРАКТЕРИСТИК ============
  socket.on('changeCharacteristic', ({ gameId, playerId, characteristic, action, value, index }) => {
    console.log('changeCharacteristic called:', { gameId, playerId, characteristic, action, value, index });
    
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }

    const initiator = game.players.find(p => p.socketId === socket.id);
    if (!initiator || initiator.id !== game.creator) {
      socket.emit('error', 'Только создатель может изменять характеристики');
      return;
    }

    const targetPlayer = game.players.find(p => p.id === playerId);
    if (!targetPlayer) {
      socket.emit('error', 'Игрок не найден');
      return;
    }

    const currentValue = targetPlayer.characteristics[characteristic].value;
    const parsed = parseCharacteristicValue(characteristic, currentValue);
    let newValue;

    switch (action) {
case 'random':
  newValue = getRandomValue(characteristic, currentValue, game.players, targetPlayer.id);
  break;
      
      case 'select':
        if (!value) {
          socket.emit('error', 'Не выбрано значение');
          return;
        }
        newValue = value;
        break;
      
      case 'add':
        if (!value) {
          socket.emit('error', 'Не выбрано значение');
          return;
        }
        if (characteristic === 'profession' || characteristic === 'gender') {
          socket.emit('error', 'Нельзя добавлять к этой характеристике');
          return;
        }
        newValue = formatCharacteristicValue(characteristic, parsed.main, [...parsed.items, value]);
        break;
      
case 'remove':
  if (index === undefined || index < 0) {
    socket.emit('error', 'Не указан элемент для удаления');
    return;
  }
  
  if (characteristic === 'profession' || characteristic === 'gender') {
    socket.emit('error', 'Нельзя удалять части этой характеристики');
    return;
  }
  
  if (index === 0) {
    // Удаляем основное значение
    if (parsed.items.length > 0) {
      // Если есть дополнительные, первое дополнительное становится основным
      newValue = formatCharacteristicValue(characteristic, parsed.items[0], parsed.items.slice(1));
    } else {
      // Если нет дополнительных, ставим прочерк
      newValue = '—';
    }
  } else {
    // Удаляем дополнительное значение
    const itemIndex = index - 1;
    if (itemIndex >= 0 && itemIndex < parsed.items.length) {
      const newItems = [...parsed.items];
      newItems.splice(itemIndex, 1);
      newValue = formatCharacteristicValue(characteristic, parsed.main, newItems);
    } else {
      socket.emit('error', 'Элемент не найден');
      return;
    }
  }
  break;
      
      default:
        socket.emit('error', 'Неизвестное действие');
        return;
    }

    targetPlayer.characteristics[characteristic].value = newValue;

    games.set(gameId, game);
    emitGameUpdateFixed(gameId);
    saveData();
    
    console.log(`Создатель изменил характеристику ${characteristic} игрока ${targetPlayer.name} на ${newValue}`);
  });
  // =========================================================

  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);
    const player = activePlayers.get(socket.id);
    if (player) {
      console.log('Игрок отключился:', player.name);
      activePlayers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});