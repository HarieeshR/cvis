import {
  analyzeIntentHandler,
  compileHandler,
  healthHandler,
  runEofHandler,
  runHandler,
  runInputHandler,
  runPollHandler,
  runStartHandler,
  runStopHandler,
  traceHandler
} from '../lib/http/route-handlers.js';

export function registerRoutes(app) {
  app.get('/health', healthHandler);
  app.post('/api/compile', compileHandler);
  app.post('/api/run', runHandler);
  app.post('/api/run/start', runStartHandler);
  app.get('/api/run/poll', runPollHandler);
  app.post('/api/run/input', runInputHandler);
  app.post('/api/run/eof', runEofHandler);
  app.post('/api/run/stop', runStopHandler);
  app.post('/api/trace', traceHandler);
  app.post('/api/analyze/intent', analyzeIntentHandler);
}
