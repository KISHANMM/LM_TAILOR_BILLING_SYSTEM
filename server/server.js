const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize DB (creates tables if not exist)
const { initDB } = require('./db');
initDB().catch(err => console.error('❌ Database Initialization Error:', err));

const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');
const pdfRouter = require('./routes/pdf');
const analyticsRouter = require('./routes/analytics');
const alterationsRouter = require('./routes/alterations');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests, or same-origin)
        if (!origin) return callback(null, true);

        // Allow any Vercel domain or localhost
        if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }

        // As a fallback for any other custom domains the user might add later
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Routes ───────────────────────────────────────
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alterations', alterationsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'LM Ladies Tailor Backend is running 🧵' });
});

// ─── Start ────────────────────────────────────────
// Export app for Vercel Serverless
module.exports = app;

if (process.env.NODE_ENV !== 'production' || require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🧵 LM Ladies Tailor Billing Server`);
        console.log(`   Running at → http://localhost:${PORT}`);
        console.log(`   Health     → http://localhost:${PORT}/api/health\n`);
    });
}
