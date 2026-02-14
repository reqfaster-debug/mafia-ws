const express = require('express');
const router = express.Router();
const lobbyManager = require('../logic/lobbyManager');

router.post('/create', async (req, res) => {
    console.log('📥 POST /api/lobby/create');
    console.log('Origin:', req.headers.origin);
    console.log('Body:', req.body);
    
    try {
        const { nickname } = req.body;
        
        if (!nickname) {
            return res.status(400).json({ error: 'Nickname is required' });
        }

        const { lobbyId, hostId } = await lobbyManager.createLobby(nickname);
        console.log(`✅ Lobby created: ${lobbyId}`);
        
        res.json({
            lobbyId,
            hostId,
            url: `/lobby.html?id=${lobbyId}`
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/:lobbyId', async (req, res) => {
    try {
        const lobby = await lobbyManager.getLobby(req.params.lobbyId);
        res.json(lobby);
    } catch (error) {
        res.status(404).json({ error: 'Lobby not found' });
    }
});

module.exports = router;