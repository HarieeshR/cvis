import cors from 'cors';
import express from 'express';
import { DEV_CORS_ORIGINS, JSON_BODY_LIMIT } from './config/constants.js';
import { getErrorMessage } from './lib/http/request-validation.js';
import { registerRoutes } from './routes/index.js';

function resolveCorsOrigin() {
  const explicitOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (explicitOrigins && explicitOrigins.length > 0) {
    return explicitOrigins.length === 1 ? explicitOrigins[0] : explicitOrigins;
  }

  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || false;
  }

  return DEV_CORS_ORIGINS;
}

export function createApp() {
  const app = express();

  app.use(cors({
    origin: resolveCorsOrigin(),
    credentials: true
  }));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  registerRoutes(app);

  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err?.status === 400 && 'body' in err)) {
      return res.status(400).json({
        error: 'Invalid JSON body',
        message: 'Request body must be valid JSON.'
      });
    }

    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Request body too large',
        message: `Request body exceeds the configured limit of ${JSON_BODY_LIMIT}.`
      });
    }

    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: getErrorMessage(err) });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
}
