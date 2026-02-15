const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Настройка CORS для конкретного домена
const io = socketIo(server, {
  cors: {
    origin: ["http://a1230559.xsph.ru", "http://localhost", "http://localhost:3000", "http://127.0.0.1:5500"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Настройка CORS для Express
app.use(cors({
  origin: ["http://a1230559.xsph.ru", "http://localhost", "http://localhost:3000", "http://127.0.0.1:5500"],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Добавляем обработку корневого маршрута для проверки работы сервера
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bunker Game Server is running' });
});

// Добавляем API маршруты
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

// Хранилище данных
const games = new Map();
const lobbies = new Map();
const players = new Map();

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
    
    traits: [
      'Храбрый', 'Трусливый', 'Добрый', 'Злой', 'Щедрый', 'Жадный',
      'Общительный', 'Замкнутый', 'Оптимист', 'Пессимист', 'Ленивый', 'Трудолюбивый'
    ],
    
    hobbies: [
      'Рыбалка', 'Охота', 'Чтение', 'Спорт', 'Рисование', 'Музыка',
      'Кулинария', 'Садоводство', 'Шахматы', 'Йога', 'Коллекционирование'
    ],
    
    health: [
      { name: 'Здоров', severity: 'легкая степень' },
      { name: 'Диабет', severity: 'средняя' },
      { name: 'Астма', severity: 'средняя' },
      { name: 'Гипертония', severity: 'легкая степень' },
      { name: 'Аллергия', severity: 'легкая степень' },
      { name: 'Проблемы с сердцем', severity: 'тяжелая' },
      { name: 'Онкология', severity: 'критическая' },
      { name: 'Артрит', severity: 'средняя' }
    ],
    
    inventory: [
      'Аптечка', 'Нож', 'Фонарик', 'Топор', 'Веревка', 'Спички',
      'Палатка', 'Спальник', 'Рация', 'Пистолет', 'Консервы', 'Вода'
    ],
    
    phobias: [
      'Клаустрофобия', 'Арахнофобия', 'Акрофобия', 'Агорафобия',
      'Социофобия', 'Гемофобия', 'Некрофобия', 'Никтофобия'
    ],
    
    extras: [
      'Водительские права', 'Знание языков', 'Навыки выживания',
      'Медицинское образование', 'Инженерные навыки', 'Педагогическое образование',
      'Военная подготовка', 'Навыки охоты', 'Умение готовить'
    ],
    
    professions: [
      { name: 'Врач', description: 'Может лечить', baseYears: 10 },
      { name: 'Инженер', description: 'Может чинить', baseYears: 8 },
      { name: 'Военный', description: 'Охрана бункера', baseYears: 7 },
      { name: 'Учитель', description: 'Обучение детей', baseYears: 6 },
      { name: 'Фермер', description: 'Выращивание еды', baseYears: 5 },
      { name: 'Строитель', description: 'Ремонт', baseYears: 9 },
      { name: 'Повар', description: 'Приготовление еды', baseYears: 4 },
      { name: 'Электрик', description: 'Ремонт электрики', baseYears: 7 }
    ]
  }
};

// Функция для генерации случайного игрока
function generatePlayer(name, socketId) {
  const gender = GAME_DATA.characteristics.genders[Math.floor(Math.random() * GAME_DATA.characteristics.genders.length)];
  const age = Math.floor(Math.random() * (80 - 18 + 1)) + 18;
  const profession = GAME_DATA.characteristics.professions[Math.floor(Math.random() * GAME_DATA.characteristics.professions.length)];
  const experience = Math.floor(Math.random() * 30) + 1;
  const health = GAME_DATA.characteristics.health[Math.floor(Math.random() * GAME_DATA.characteristics.health.length)];
  
  return {
    id: uuidv4(),
    socketId,
    name,
    characteristics: {
      gender: {
        value: `${gender} (${age} лет)`,
        revealed: false
      },
      bodyType: {
        value: GAME_DATA.characteristics.bodyTypes[Math.floor(Math.random() * GAME_DATA.characteristics.bodyTypes.length)],
        revealed: false
      },
      trait: {
        value: GAME_DATA.characteristics.traits[Math.floor(Math.random() * GAME_DATA.characteristics.traits.length)],
        revealed: false
      },
      profession: {
        value: `${profession.name} (стаж ${experience} лет) - ${profession.description}`,
        revealed: false
      },
      hobby: {
        value: GAME_DATA.characteristics.hobbies[Math.floor(Math.random() * GAME_DATA.characteristics.hobbies.length)],
        revealed: false
      },
      health: {
        value: `${health.name} (${health.severity})`,
        revealed: false
      },
      inventory: {
        value: GAME_DATA.characteristics.inventory[Math.floor(Math.random() * GAME_DATA.characteristics.inventory.length)],
        revealed: false
      },
      phobia: {
        value: GAME_DATA.characteristics.phobias[Math.floor(Math.random() * GAME_DATA.characteristics.phobias.length)],
        revealed: false
      },
      extra: {
        value: GAME_DATA.characteristics.extras[Math.floor(Math.random() * GAME_DATA.characteristics.extras.length)],
        revealed: false
      }
    }
  };
}

// Создание новой игры
function createGame(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;
  
  const gameId = uuidv4();
  const game = {
    id: gameId,
    disaster: GAME_DATA.disasters[Math.floor(Math.random() * GAME_DATA.disasters.length)],
    bunker: GAME_DATA.bunkers[Math.floor(Math.random() * GAME_DATA.bunkers.length)],
    players: lobby.players,
    status: 'active'
  };
  
  games.set(gameId, game);
  lobbies.delete(lobbyId);
  
  return game;
}

// Очистка старых лобби (каждый час)
setInterval(() => {
  const now = Date.now();
  for (const [id, lobby] of lobbies) {
    if (now - lobby.created > 3600000) { // 1 час
      lobbies.delete(id);
    }
  }
}, 3600000);

// Socket.IO подключения
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);
  
  // Создание лобби через socket (дублируем для совместимости)
  socket.on('createLobby', () => {
    const lobbyId = uuidv4().substring(0, 6).toUpperCase();
    lobbies.set(lobbyId, {
      id: lobbyId,
      players: [],
      created: Date.now()
    });
    
    socket.emit('lobbyCreated', { lobbyId });
  });
  
  // Проверка лобби
  socket.on('checkLobby', ({ lobbyId }) => {
    const lobby = lobbies.get(lobbyId);
    socket.emit('lobbyCheckResult', { exists: !!lobby });
  });
  
  // Вход в лобби
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Лобби не найдено');
      return;
    }
    
    // Проверяем, нет ли уже игрока с таким ником
    if (lobby.players.some(p => p.name === playerName)) {
      socket.emit('error', 'Игрок с таким ником уже существует');
      return;
    }
    
    const player = generatePlayer(playerName, socket.id);
    lobby.players.push(player);
    players.set(socket.id, { ...player, lobbyId });
    
    socket.join(lobbyId);
    socket.emit('joinedLobby', { lobbyId, player: player });
    io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players });
  });
  
  // Начало игры
  socket.on('startGame', ({ lobbyId }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    
    if (lobby.players.length < 4) {
      socket.emit('error', 'Недостаточно игроков (нужно минимум 4)');
      return;
    }
    
    const game = createGame(lobbyId);
    if (game) {
      // Отправляем каждому игроку его данные
      game.players.forEach(player => {
        io.to(player.socketId).emit('gameStarted', {
          gameId: game.id,
          disaster: game.disaster,
          bunker: game.bunker,
          player: player
        });
      });
    }
  });
  
  // Раскрытие характеристики
  socket.on('revealCharacteristic', ({ gameId, characteristic }) => {
    const game = games.get(gameId);
    if (!game) return;
    
    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;
    
    player.characteristics[characteristic].revealed = true;
    
    // Отправляем всем в игре обновленные данные
    game.players.forEach(p => {
      io.to(p.socketId).emit('characteristicRevealed', {
        playerId: player.id,
        characteristic,
        value: player.characteristics[characteristic].value,
        revealedBy: player.name
      });
    });
  });
  
  // Отключение
  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);
    const playerData = players.get(socket.id);
    if (playerData) {
      const { lobbyId } = playerData;
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        lobby.players = lobby.players.filter(p => p.socketId !== socket.id);
        io.to(lobbyId).emit('lobbyUpdate', { players: lobby.players });
      }
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});