const os = require('os');
const { spawn } = require('child_process');

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

const child = spawn('npx', ['next', 'dev', '-H', '0.0.0.0'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' },
});

child.stdout.on('data', (chunk) => process.stdout.write(replaceNetworkUrl(chunk.toString())));
child.stderr.on('data', (chunk) => process.stderr.write(replaceNetworkUrl(chunk.toString())));

child.on('exit', (code) => process.exit(code ?? 0));
