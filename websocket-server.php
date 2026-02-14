<?php
require_once 'vendor/autoload.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class BunkerWebSocket implements MessageComponentInterface {
    private $clients;
    private $lobbies;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->lobbies = [];
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Новое подключение! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        
        if (!$data) return;

        switch ($data['type']) {
            case 'join_lobby':
                $this->handleJoinLobby($from, $data);
                break;
                
            case 'player_update':
                $this->handlePlayerUpdate($from, $data);
                break;
                
            case 'reveal_character':
                $this->handleRevealCharacter($from, $data);
                break;
                
            case 'change_character':
                $this->handleChangeCharacter($from, $data);
                break;
                
            case 'voting_start':
                $this->handleVotingStart($from, $data);
                break;
                
            case 'voting_end':
                $this->handleVotingEnd($from, $data);
                break;
                
            case 'player_killed':
                $this->handlePlayerKilled($from, $data);
                break;
                
            case 'host_changed':
                $this->handleHostChanged($from, $data);
                break;
                
            case 'play_sound':
                $this->handlePlaySound($from, $data);
                break;
        }
    }

    public function onClose(ConnectionInterface $conn) {
        // Помечаем игрока как оффлайн
        foreach ($this->lobbies as $lobbyId => $lobby) {
            foreach ($lobby['connections'] as $playerId => $connection) {
                if ($connection === $conn) {
                    // Обновляем статус в файле
                    $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
                    foreach ($lobbyData['players'] as &$player) {
                        if ($player['id'] === $playerId) {
                            $player['online'] = false;
                            break;
                        }
                    }
                    file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
                    
                    // Уведомляем остальных
                    $this->broadcastToLobby($lobbyId, [
                        'type' => 'player_offline',
                        'player_id' => $playerId
                    ]);
                    
                    unset($this->lobbies[$lobbyId]['connections'][$playerId]);
                    break;
                }
            }
        }
        
        $this->clients->detach($conn);
        echo "Подключение {$conn->resourceId} закрыто\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Ошибка: {$e->getMessage()}\n";
        $conn->close();
    }

    private function handleJoinLobby($conn, $data) {
        $lobbyId = $data['lobby_id'];
        $playerId = $data['player_id'];
        
        if (!isset($this->lobbies[$lobbyId])) {
            $this->lobbies[$lobbyId] = [
                'connections' => []
            ];
        }
        
        $this->lobbies[$lobbyId]['connections'][$playerId] = $conn;
        
        // Загружаем данные лобби
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        
        // Обновляем статус игрока
        foreach ($lobbyData['players'] as &$player) {
            if ($player['id'] === $playerId) {
                $player['online'] = true;
                break;
            }
        }
        
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        // Уведомляем всех в лобби
        $this->broadcastToLobby($lobbyId, [
            'type' => 'player_joined',
            'player_id' => $playerId,
            'players' => $lobbyData['players']
        ]);
    }

    private function handlePlayerUpdate($conn, $data) {
        $lobbyId = $data['lobby_id'];
        $playerId = $data['player_id'];
        
        // Обновляем данные в файле
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        foreach ($lobbyData['players'] as &$player) {
            if ($player['id'] === $playerId) {
                $player['character'] = $data['character'];
                break;
            }
        }
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        // Рассылаем обновление
        $this->broadcastToLobby($lobbyId, [
            'type' => 'player_updated',
            'player_id' => $playerId,
            'character' => $data['character']
        ]);
    }

    private function handleRevealCharacter($conn, $data) {
        $lobbyId = $data['lobby_id'];
        $playerId = $data['player_id'];
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'character_revealed',
            'player_id' => $playerId,
            'character' => $data['character']
        ]);
    }

    private function handleChangeCharacter($conn, $data) {
        $lobbyId = $data['lobby_id'];
        $playerId = $data['player_id'];
        
        // Обновляем данные в файле
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        foreach ($lobbyData['players'] as &$player) {
            if ($player['id'] === $playerId) {
                $player['character'] = $data['character'];
                break;
            }
        }
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'character_changed',
            'player_id' => $playerId,
            'character' => $data['character']
        ]);
    }

    private function handleVotingStart($conn, $data) {
        $lobbyId = $data['lobby_id'];
        
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        $lobbyData['voting'] = [
            'active' => true,
            'start_time' => time(),
            'votes' => []
        ];
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'voting_started',
            'end_time' => time() + 15
        ]);
    }

    private function handleVotingEnd($conn, $data) {
        $lobbyId = $data['lobby_id'];
        
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        unset($lobbyData['voting']);
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'voting_ended',
            'results' => $data['results']
        ]);
    }

    private function handlePlayerKilled($conn, $data) {
        $lobbyId = $data['lobby_id'];
        $playerId = $data['player_id'];
        
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        foreach ($lobbyData['players'] as &$player) {
            if ($player['id'] === $playerId) {
                $player['status'] = 'dead';
                break;
            }
        }
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'player_killed',
            'player_id' => $playerId
        ]);
    }

    private function handleHostChanged($conn, $data) {
        $lobbyId = $data['lobby_id'];
        $newHostId = $data['new_host_id'];
        
        $lobbyData = json_decode(file_get_contents(__DIR__ . "/data/lobby_{$lobbyId}.json"), true);
        $lobbyData['host_id'] = $newHostId;
        file_put_contents(__DIR__ . "/data/lobby_{$lobbyId}.json", json_encode($lobbyData, JSON_PRETTY_PRINT));
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'host_changed',
            'host_id' => $newHostId
        ]);
    }

    private function handlePlaySound($conn, $data) {
        $lobbyId = $data['lobby_id'];
        
        $this->broadcastToLobby($lobbyId, [
            'type' => 'play_sound',
            'sound' => $data['sound']
        ]);
    }

    private function broadcastToLobby($lobbyId, $message) {
        if (!isset($this->lobbies[$lobbyId])) return;
        
        $message = json_encode($message);
        
        foreach ($this->lobbies[$lobbyId]['connections'] as $playerId => $connection) {
            $connection->send($message);
        }
    }
}

// Запуск сервера
$server = \Ratchet\Server\IoServer::factory(
    new \Ratchet\Http\HttpServer(
        new \Ratchet\WebSocket\WsServer(
            new BunkerWebSocket()
        )
    ),
    8080
);

echo "WebSocket сервер запущен на порту 8080...\n";
$server->run();