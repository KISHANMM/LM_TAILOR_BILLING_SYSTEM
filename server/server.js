const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Initialize DB (creates tables if not exist)
const { initDB } = require('./db');
initDB().catch(err => console.error('❌ Database Initialization Error:', err));

const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');
const pdfRouter = require('./routes/pdf');
const analyticsRouter = require('./routes/analytics');
const alterationsRouter = require('./routes/alterations');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// ─── Security Headers (helmet) ────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow PDF/image fetches from frontend
}));

// ─── CORS — explicit allowlist only ──────────────
const ALLOWED_ORIGINS = [
    /^https:\/\/.*\.vercel\.app$/,       // any Vercel preview/prod deployment
    /^http:\/\/localhost:\d+$/,           // local dev (any port)
    /^http:\/\/127\.0\.0\.1:\d+$/,       // local dev alt
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow no-origin requests (mobile apps, Postman, same-origin server calls)
        if (!origin) return callback(null, true);

        const allowed = ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
        if (allowed) return callback(null, true);

        callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
}));

// ─── Body Size Limit (2 MB max) ──────────────────
// 50mb was a DoS risk. Images are sent as base64 in order creation (max ~1-2 per request).
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ─── Rate Limiting ────────────────────────────────
// General: 120 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/', generalLimiter);

// ─── Routes ───────────────────────────────────────
// Unprotected auth endpoint
app.use('/api/auth', authRouter);

// Protected data endpoints
app.use('/api/customers', requireAuth, customersRouter);
app.use('/api/orders', requireAuth, ordersRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/pdf', requireAuth, pdfRouter);
app.use('/api/analytics', requireAdmin, analyticsRouter);
app.use('/api/alterations', requireAuth, alterationsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'LM Ladies Tailor Backend is running 🧵' });
});

// ─── Central Error Handler ────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────
// Export app for Vercel Serverless
module.exports = app;

if (!isProd || require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🧵 LM Ladies Tailor Billing Server`);
        console.log(`   Running at → http://localhost:${PORT}`);
        console.log(`   Health     → http://localhost:${PORT}/api/health`);
        console.log(`   Mode       → ${process.env.NODE_ENV || 'development'}\n`);
    });
}
