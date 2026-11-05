const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'lm_tailor_secure_session_secret_key_2026';

/**
 * Generate a signed bearer token for a user
 */
function generateToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        role: user.role,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
    })).toString('base64url');

    const signature = crypto
        .createHmac('sha256', SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    return `${header}.${payload}.${signature}`;
}

/**
 * Verify a bearer token string
 */
function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
        .createHmac('sha256', SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    // Constant time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
    }

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired token
        }
        return decoded;
    } catch {
        return null;
    }
}

/**
 * Express middleware to enforce authentication
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
    }

    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }

    req.user = user;
    next();
}

/**
 * Express middleware to enforce Admin role authorization
 */
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user && req.user.role === 'Admin') {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden: Admin privilege required' });
    });
}

module.exports = {
    generateToken,
    verifyToken,
    requireAuth,
    requireAdmin
};
