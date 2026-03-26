import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();
const buildDir = path.join(rootDir, 'build');
const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

if (!existsSync(buildDir)) {
  console.error('Production build not found.');
  console.error('Run `npm run build` first, then start the production stack.');
  process.exit(1);
}

const backendPort = process.env.BACKEND_PORT || '3001';
const backendHost = process.env.BACKEND_HOST || '127.0.0.1';
const frontendPort = process.env.FRONTEND_PORT || '3000';
const frontendHost = process.env.FRONTEND_HOST || '0.0.0.0';
const frontendPublicHost = frontendHost === '0.0.0.0' ? 'localhost' : frontendHost;
const publicApiBase = process.env.PUBLIC_API_BASE || `http://${backendHost}:${backendPort}`;
const frontendUrl = process.env.FRONTEND_URL || `http://${frontendPublicHost}:${frontendPort}`;
const corsOrigins = process.env.CORS_ORIGINS || frontendUrl;

console.log('');
console.log('═══════════════════════════════════════════════');
console.log('  cvis Production Stack');
console.log('═══════════════════════════════════════════════');
console.log(`  Frontend: ${frontendUrl}`);
console.log(`  Backend:  http://${backendHost}:${backendPort}`);
console.log(`  API Base: ${publicApiBase}`);
console.log('═══════════════════════════════════════════════');
console.log('');

const children = [];
let shuttingDown = false;

function spawnNode(name, args, envOverrides) {
  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...envOverrides
    },
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const runningChild of children) {
      if (runningChild !== child && !runningChild.killed) {
        runningChild.kill('SIGTERM');
      }
    }

    if (signal) {
      console.error(`${name} exited due to signal ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 0);
  });

  children.push(child);
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

spawnNode('backend', [tsxCli, 'server/index.ts'], {
  NODE_ENV: 'production',
  PORT: backendPort,
  BACKEND_HOST: backendHost,
  FRONTEND_URL: frontendUrl,
  CORS_ORIGINS: corsOrigins
});

spawnNode('frontend', ['build'], {
  NODE_ENV: 'production',
  PORT: frontendPort,
  HOST: frontendHost,
  PUBLIC_API_BASE: publicApiBase
});
