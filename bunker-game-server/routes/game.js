const express = require('express');
const router = express.Router();
const lobbyManager = require('../logic/lobbyManager');

router.post('/:lobbyId/start', async (req, res) => {
    try {
        const { gameData } = req.body;
        const result = await lobbyManager.startGame(req.params.lobbyId, gameData);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;