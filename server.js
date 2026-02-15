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

// Сохранение данных в файлы
async function saveData() {
  try {
    await ensureDataDir();

    // Сохраняем игры
    await fs.writeFile(GAMES_FILE, JSON.stringify(Array.from(games.entries()), null, 2));

    // Сохраняем лобби
    await fs.writeFile(LOBBIES_FILE, JSON.stringify(Array.from(lobbies.entries()), null, 2));

    // Сохраняем игроков
    await fs.writeFile(PLAYERS_FILE, JSON.stringify(Array.from(playersDataMap.entries()), null, 2));

    console.log('Данные сохранены');
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
  }
}

// Хранилища данных
let games = new Map();        // Активные игры
let lobbies = new Map();      // Лобби
const activePlayers = new Map(); // Активные игроки (socketId -> playerData)
let playersDataMap = new Map();  // ПОСТОЯННОЕ хранение данных игроков (playerId -> playerData)
const playerGameMap = new Map();  // Связь playerId -> gameId

// Загружаем данные при старте
loadData();

// Сохраняем данные каждые 5 минут
setInterval(saveData, 5 * 60 * 1000);

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
    traits: ['Храбрый', 'Трусливый', 'Добрый', 'Злой', 'Щедрый', 'Жадный'],
    hobbies: ['Рыбалка', 'Охота', 'Чтение', 'Спорт', 'Рисование', 'Музыка'],
    health: [
      { name: 'Здоров', severity: 'легкая степень' },
      { name: 'Диабет', severity: 'средняя' },
      { name: 'Астма', severity: 'средняя' }
    ],
    inventory: ['Аптечка', 'Нож', 'Фонарик', 'Топор', 'Веревка', 'Спички'],
    phobias: ['Клаустрофобия', 'Арахнофобия', 'Акрофобия'],
    extras: ['Водительские права', 'Знание языков', 'Навыки выживания'],
    professions: [
      { name: 'Врач', description: 'Может лечить' },
      { name: 'Инженер', description: 'Может чинить' },
      { name: 'Военный', description: 'Охрана бункера' }
    ]
  }
};

// Функция генерации игрока
function generatePlayer(name, socketId) {
  const gender = GAME_DATA.characteristics.genders[Math.floor(Math.random() * GAME_DATA.characteristics.genders.length)];
  const age = Math.floor(Math.random() * (80 - 18 + 1)) + 18;
  const profession = GAME_DATA.characteristics.professions[Math.floor(Math.random() * GAME_DATA.characteristics.professions.length)];
  const experience = Math.floor(Math.random() * 30) + 1;
  const health = GAME_DATA.characteristics.health[Math.floor(Math.random() * GAME_DATA.characteristics.health.length)];

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
      health: { value: `${health.name} (${health.severity})`, revealed: false },
      inventory: { value: GAME_DATA.characteristics.inventory[Math.floor(Math.random() * GAME_DATA.characteristics.inventory.length)], revealed: false },
      phobia: { value: GAME_DATA.characteristics.phobias[Math.floor(Math.random() * GAME_DATA.characteristics.phobias.length)], revealed: false },
      extra: { value: GAME_DATA.characteristics.extras[Math.floor(Math.random() * GAME_DATA.characteristics.extras.length)], revealed: false }
    }
  };

  // Сохраняем в постоянное хранилище
  playersDataMap.set(player.id, player);
  saveData(); // Сохраняем сразу

  return player;
}

// API маршруты
app.post('/api/create-lobby', (req, res) => {
  try {
    const lobbyId = uuidv4().substring(0, 6).toUpperCase();
    lobbies.set(lobbyId, {
      id: lobbyId,
      players: [],
      created: Date.now()
    });

    saveData(); // Сохраняем изменения
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

    // Проверяем в играх
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
            lobbyId: game.lobbyId, // Теперь есть lobbyId
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

    // Проверяем в лобби (даже если игра началась)
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

    // Проверяем в постоянном хранилище
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



  // Восстановление соединения
  socket.on('reconnectPlayer', ({ playerId }) => {
    console.log('Попытка восстановления игрока:', playerId);

    // Проверяем, есть ли уже активное соединение
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

    // Сначала проверяем в играх
    const gameId = playerGameMap.get(playerId);
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        const player = game.players.find(p => p.id === playerId);
        if (player) {
          // Обновляем socketId
          player.socketId = socket.id;
          activePlayers.set(socket.id, player);

          socket.join(gameId);

          socket.emit('reconnectSuccess', {
            type: 'game',
            gameId: gameId,
            disaster: game.disaster,
            bunker: game.bunker,
            player: player,
            players: game.players
          });

          console.log('Игрок восстановлен в игре:', player.name);
          return;
        }
      }
    }

    // Затем проверяем в лобби
    for (const [lId, lobby] of lobbies) {
      const player = lobby.players.find(p => p.id === playerId);
      if (player) {
        // Обновляем socketId
        player.socketId = socket.id;
        activePlayers.set(socket.id, player);

        socket.join(lId);

        socket.emit('reconnectSuccess', {
          type: 'lobby',
          lobbyId: lId,
          player: player,
          players: lobby.players
        });

        // Уведомляем всех об обновлении
        io.to(lId).emit('lobbyUpdate', { players: lobby.players });

        console.log('Игрок восстановлен в лобби:', player.name);
        return;
      }
    }

    // Если ничего не найдено, пробуем найти в сохраненных данных
    const savedPlayer = playersDataMap.get(playerId);
    if (savedPlayer) {
      // Ищем лобби, где мог быть этот игрок
      for (const [lId, lobby] of lobbies) {
        if (lobby.players.some(p => p.id === playerId)) {
          // Уже должно было найтись выше
          continue;
        }
      }
    }

    // Если ничего не найдено
    socket.emit('reconnectFailed', { message: 'Игрок не найден' });
  });

  // При новом подключении проверяем, не активен ли уже игрок
  socket.on('checkPlayerActive', ({ playerId }) => {
    const isActive = [...activePlayers.values()].some(p => p.id === playerId);
    socket.emit('playerActiveCheck', { active: isActive });
  });

  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    console.log('Попытка входа в лобби:', lobbyId, playerName);

    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Лобби не найдено');
      return;
    }

    // Проверяем, есть ли уже игрок с таким ником
    const existingPlayer = lobby.players.find(p => p.name === playerName);

    if (existingPlayer) {
      console.log('Игрок уже существует, обновляем соединение:', playerName);

      // Обновляем socketId у существующего игрока
      existingPlayer.socketId = socket.id;
      activePlayers.set(socket.id, existingPlayer);

      socket.join(lobbyId);
      socket.emit('joinedLobby', { lobbyId, player: existingPlayer });

      // Уведомляем всех об обновлении списка
      io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players });

      return;
    }

    // Если игрока нет - создаем нового
    const player = generatePlayer(playerName, socket.id);
    lobby.players.push(player);
    activePlayers.set(socket.id, player);

    socket.join(lobbyId);
    socket.emit('joinedLobby', { lobbyId, player });
    io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players });

    saveData();
    console.log('Новый игрок присоединился:', playerName);
  });

  socket.on('startGame', ({ lobbyId }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

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
      lobbyId: lobbyId // Сохраняем ссылку на лобби
    };

    games.set(gameId, game);

    // Обновляем статус лобби, но НЕ УДАЛЯЕМ его
    lobby.status = 'game_started';
    lobby.gameId = gameId;

    // Сохраняем связь для каждого игрока
    game.players.forEach(player => {
      playerGameMap.set(player.id, gameId);
    });

    game.players.forEach(player => {
      io.to(player.socketId).emit('gameStarted', {
        gameId: game.id,
        disaster: game.disaster,
        bunker: game.bunker,
        player: player,
        players: game.players
      });
    });

    saveData(); // Сохраняем изменения
    console.log('Игра создана:', gameId);
    console.log('Лобби сохранено:', lobbyId);
  });

  socket.on('revealCharacteristic', ({ gameId, characteristic }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;

    player.characteristics[characteristic].revealed = true;

    // Обновляем в постоянном хранилище
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

    saveData(); // Сохраняем изменения
  });

  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);
    const player = activePlayers.get(socket.id);
    if (player) {
      console.log('Игрок отключился:', player.name);
      activePlayers.delete(socket.id);
      // Данные игрока остаются в playersDataMap для восстановления
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});