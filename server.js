const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

// Хранилища данных
const games = new Map();        // Активные игры
const lobbies = new Map();      // Лобби
const players = new Map();      // Активные игроки (socketId -> playerData)
const playerGames = new Map();   // Связь playerId -> gameId (для переподключения)
const playerData = new Map();    // Постоянное хранение данных игроков (playerId -> playerData)

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
  
  // Сохраняем данные игрока в постоянном хранилище
  playerData.set(player.id, player);
  
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

// API для проверки активной игры
app.get('/api/check-game/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;
    const gameId = playerGames.get(playerId);
    
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        // Ищем игрока в игре
        const player = game.players.find(p => p.id === playerId);
        if (player) {
          res.json({
            active: true,
            gameId: gameId,
            player: player,
            gameData: {
              disaster: game.disaster,
              bunker: game.bunker,
              players: game.players
            }
          });
          return;
        }
      }
    }
    
    // Если не нашли в активных играх, проверяем в лобби
    for (const [lobbyId, lobby] of lobbies) {
      const player = lobby.players.find(p => p.id === playerId);
      if (player) {
        res.json({
          active: true,
          lobbyId: lobbyId,
          player: player,
          inLobby: true
        });
        return;
      }
    }
    
    res.json({ active: false });
  } catch (error) {
    console.error('Ошибка проверки игры:', error);
    res.status(500).json({ error: 'Ошибка проверки игры' });
  }
});

// API для получения данных игрока
app.get('/api/player/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;
    const player = playerData.get(playerId);
    
    if (player) {
      res.json({ found: true, player });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Ошибка получения игрока:', error);
    res.status(500).json({ error: 'Ошибка получения игрока' });
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);
  
  // Переподключение к существующей игре
  socket.on('reconnectToGame', ({ playerId, gameId }) => {
    console.log('Попытка переподключения:', playerId, gameId);
    
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Игра не найдена');
      return;
    }
    
    // Ищем игрока в игре
    let player = game.players.find(p => p.id === playerId);
    
    // Если не нашли, пробуем получить из постоянного хранилища
    if (!player) {
      const savedPlayer = playerData.get(playerId);
      if (savedPlayer) {
        player = savedPlayer;
        game.players.push(player);
      }
    }
    
    if (!player) {
      socket.emit('error', 'Игрок не найден');
      return;
    }
    
    // Обновляем socketId
    player.socketId = socket.id;
    players.set(socket.id, player);
    
    socket.join(gameId);
    
    // Отправляем игроку данные игры
    socket.emit('gameReconnected', {
      gameId: game.id,
      disaster: game.disaster,
      bunker: game.bunker,
      player: player,
      players: game.players
    });
    
    // Уведомляем других игроков о переподключении
    socket.to(gameId).emit('playerReconnected', {
      playerId: player.id,
      playerName: player.name
    });
    
    console.log('Игрок переподключился:', player.name);
  });
  
  // Переподключение к лобби
  socket.on('reconnectToLobby', ({ playerId, lobbyId }) => {
    console.log('Попытка переподключения к лобби:', playerId, lobbyId);
    
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Лобби не найдено');
      return;
    }
    
    // Ищем игрока в лобби
    let player = lobby.players.find(p => p.id === playerId);
    
    // Если не нашли, пробуем получить из постоянного хранилища
    if (!player) {
      const savedPlayer = playerData.get(playerId);
      if (savedPlayer) {
        player = savedPlayer;
        player.socketId = socket.id;
        lobby.players.push(player);
      }
    }
    
    if (!player) {
      socket.emit('error', 'Игрок не найден');
      return;
    }
    
    // Обновляем socketId
    player.socketId = socket.id;
    players.set(socket.id, player);
    
    socket.join(lobbyId);
    
    // Отправляем игроку данные лобби
    socket.emit('lobbyReconnected', {
      lobbyId: lobbyId,
      player: player,
      players: lobby.players
    });
    
    // Уведомляем всех об обновлении
    io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players });
    
    console.log('Игрок переподключился к лобби:', player.name);
  });
  
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    console.log('Попытка входа в лобби:', lobbyId, playerName);
    
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Лобби не найдено');
      return;
    }
    
    if (lobby.players.some(p => p.name === playerName)) {
      socket.emit('error', 'Игрок с таким ником уже существует');
      return;
    }
    
    const player = generatePlayer(playerName, socket.id);
    lobby.players.push(player);
    players.set(socket.id, player);
    
    socket.join(lobbyId);
    socket.emit('joinedLobby', { lobbyId, player });
    io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players });
    
    console.log('Игрок присоединился:', playerName);
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
      status: 'active'
    };
    
    games.set(gameId, game);
    
    // Сохраняем связь playerId -> gameId для каждого игрока
    game.players.forEach(player => {
      playerGames.set(player.id, gameId);
    });
    
    lobbies.delete(lobbyId);
    
    game.players.forEach(player => {
      io.to(player.socketId).emit('gameStarted', {
        gameId: game.id,
        disaster: game.disaster,
        bunker: game.bunker,
        player: player,
        players: game.players
      });
    });
    
    console.log('Игра создана:', gameId);
  });
  
  socket.on('revealCharacteristic', ({ gameId, characteristic }) => {
    const game = games.get(gameId);
    if (!game) return;
    
    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;
    
    player.characteristics[characteristic].revealed = true;
    
    // Обновляем в постоянном хранилище
    const savedPlayer = playerData.get(player.id);
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
  });
  
  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);
    const player = players.get(socket.id);
    if (player) {
      // Не удаляем данные игрока, чтобы он мог переподключиться
      console.log('Игрок отключился:', player.name);
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});