import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const backendPort = 3301;
const backendHost = '127.0.0.1';
const frontendPort = 4300;
const frontendHost = '127.0.0.1';
const frontendUrl = `http://${frontendHost}:${frontendPort}`;
const backendUrl = `http://${backendHost}:${backendPort}`;

function spawnNode(args, envOverrides) {
  return spawn(process.execPath, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...envOverrides
    },
    stdio: 'pipe'
  });
}

function mirrorOutput(label, child) {
  child.stdout?.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
}

async function waitFor(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `${label} did not become ready in time${lastError instanceof Error ? `: ${lastError.message}` : ''}`
  );
}

async function main() {
  const backend = spawnNode(['server/index.js'], {
    NODE_ENV: 'production',
    PORT: String(backendPort),
    BACKEND_HOST: backendHost,
    FRONTEND_URL: frontendUrl,
    CORS_ORIGINS: frontendUrl
  });
  const frontend = spawnNode(['build'], {
    NODE_ENV: 'production',
    PORT: String(frontendPort),
    HOST: frontendHost,
    PUBLIC_API_BASE: backendUrl
  });

  mirrorOutput('backend', backend);
  mirrorOutput('frontend', frontend);

  const cleanup = () => {
    if (!backend.killed) backend.kill('SIGTERM');
    if (!frontend.killed) frontend.kill('SIGTERM');
  };

  try {
    const healthResponse = await waitFor(`${backendUrl}/health`, 'Backend health');
    const healthJson = await healthResponse.json();
    if (healthJson.status !== 'ok') {
      throw new Error(`Unexpected backend health payload: ${JSON.stringify(healthJson)}`);
    }

    const frontendResponse = await waitFor(frontendUrl, 'Frontend root');
    const html = await frontendResponse.text();
    if (!html.includes('<!doctype html>')) {
      throw new Error('Frontend root did not return HTML');
    }

    console.log('');
    console.log('Production smoke test passed.');
    console.log(`Frontend: ${frontendUrl}`);
    console.log(`Backend: ${backendUrl}`);
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
