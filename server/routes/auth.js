const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { generateToken, requireAuth } = require('../middleware/auth');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LataMagaji';

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { role, password } = req.body;

    if (!role || (role !== 'Admin' && role !== 'Worker')) {
        return res.status(400).json({ error: 'Invalid role specified' });
    }

    if (role === 'Admin') {
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        // Timing-safe comparison to prevent password timing leaks
        const passBuf = Buffer.from(password);
        const adminPassBuf = Buffer.from(ADMIN_PASSWORD);

        let match = false;
        if (passBuf.length === adminPassBuf.length) {
            match = crypto.timingSafeEqual(passBuf, adminPassBuf);
        }

        if (!match) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const user = { role: 'Admin', name: 'Lata' };
        const token = generateToken(user);
        return res.json({ token, user, message: 'Welcome back, Admin!' });
    }

    if (role === 'Worker') {
        const user = { role: 'Worker', name: 'Praveen' };
        const token = generateToken(user);
        return res.json({ token, user, message: 'Logged in as Praveen' });
    }
});

// GET /api/auth/me (Verify active session token)
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
