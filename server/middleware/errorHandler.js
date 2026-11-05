/**
 * Central error handler middleware.
 * In production: sends a generic message so internals are never exposed.
 * In development: sends the real error message for easier debugging.
 */
function errorHandler(err, req, res, next) {
    console.error('[ERROR]', req.method, req.path, err.message || err);

    const isProd = process.env.NODE_ENV === 'production';
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        error: isProd ? 'Internal server error' : (err.message || 'Internal server error'),
    });
}

module.exports = errorHandler;
