/**
 * Erreur applicative typée, à lever depuis les controllers/services
 * pour garder un format de réponse cohérent.
 */
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'not_found',
    message: `Route inconnue : ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  // Erreurs de validation Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Les données envoyées sont invalides.',
      details: err.errors,
    });
  }

  console.error('[unhandled error]', err);

  res.status(500).json({
    error: 'internal_error',
    message: 'Une erreur interne est survenue.',
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };