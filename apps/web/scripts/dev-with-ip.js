const os = require('os');
const net = require('net');
const { spawn } = require('child_process');

const API_PORT = parseInt(process.env.NEXT_PUBLIC_API_PORT || '4000', 10);
const API_WAIT_TIMEOUT_MS = 60000; // 60 sec
const API_WAIT_INTERVAL_MS = 500;

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function tryConnect() {
      const socket = new net.Socket();
      const onErr = () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`API (port ${port}) did not become ready in ${timeoutMs}ms`));
          return;
        }
        setTimeout(tryConnect, API_WAIT_INTERVAL_MS);
      };
      socket.setTimeout(2000);
      socket.once('error', onErr);
      socket.once('timeout', onErr);
      socket.connect(port, '127.0.0.1', () => {
        socket.destroy();
        resolve();
      });
    }
    tryConnect();
  });
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const ip = getLocalIp();
const port = process.env.PORT || 3000;

function replaceNetworkUrl(text) {
  if (!ip) return text;
  return text.replace('http://0.0.0.0:' + port, 'http://' + ip + ':' + port);
}

function main() {
  const skipWait = process.env.SKIP_API_WAIT === '1' || process.env.SKIP_API_WAIT === 'true';
  const run = () => {
    const child = spawn('npx', ['next', 'dev', '-H', '0.0.0.0'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    child.stdout.on('data', (chunk) => process.stdout.write(replaceNetworkUrl(chunk.toString())));
    child.stderr.on('data', (chunk) => process.stderr.write(replaceNetworkUrl(chunk.toString())));
    child.on('exit', (code) => process.exit(code ?? 0));
  };

  if (skipWait) {
    run();
    return;
  }
  console.log(`Waiting for API on port ${API_PORT}...`);
  waitForPort(API_PORT, API_WAIT_TIMEOUT_MS)
    .then(() => {
      console.log('API is ready, starting Next.js...');
      run();
    })
    .catch((err) => {
      console.error(err.message);
      console.error('Start API first: cd apps/api && pnpm run dev');
      process.exit(1);
    });
}

main();
