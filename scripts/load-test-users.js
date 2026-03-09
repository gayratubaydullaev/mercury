/**
 * Load test: симуляция активных пользователей.
 * Каждый "пользователь" делает несколько запросов с паузами между ними (как реальный юзер).
 *
 * Usage: node scripts/load-test-users.js [baseUrl] [numUsers] [requestsPerUser] [minDelayMs] [maxDelayMs]
 * Example: node scripts/load-test-users.js http://localhost:4000 50 10 500 2000
 *
 * 50 пользователей, каждый делает 10 запросов, пауза между запросами 0.5–2 сек.
 */
const baseUrl = process.argv[2] || 'http://localhost:4000';
const numUsers = parseInt(process.argv[3] || '50', 10) || 50;
const requestsPerUser = parseInt(process.argv[4] || '10', 10) || 10;
const minDelayMs = parseInt(process.argv[5] || '500', 10) || 500;
const maxDelayMs = parseInt(process.argv[6] || '2000', 10) || 2000;

const url = `${baseUrl.replace(/\/$/, '')}/banners`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function request() {
  const start = Date.now();
  return fetch(url, { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : r.text()))
    .then(() => ({ ok: true, ms: Date.now() - start }))
    .catch((e) => ({ ok: false, ms: Date.now() - start, err: e.message }));
}

async function runUser(userId, results) {
  for (let i = 0; i < requestsPerUser; i++) {
    const result = await request();
    results.push(result);
    if (i < requestsPerUser - 1) {
      const delay = randomBetween(minDelayMs, maxDelayMs);
      await sleep(delay);
    }
  }
}

async function run() {
  console.log(`Load test (active users): ${url}`);
  console.log(
    `Users: ${numUsers}, Requests per user: ${requestsPerUser}, Delay: ${minDelayMs}-${maxDelayMs} ms\n`
  );

  const results = [];
  const start = Date.now();
  await Promise.all(Array.from({ length: numUsers }, (_, i) => runUser(i, results)));
  const elapsed = Date.now() - start;

  const failed = results.filter((r) => !r.ok).length;
  const latencies = results.map((r) => r.ms).filter((ms) => ms >= 0);
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const totalRequests = results.length;
  const rps = (totalRequests / elapsed) * 1000;

  console.log(`Completed: ${totalRequests} requests, Failed: ${failed}, Time: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`RPS: ${rps.toFixed(1)}, P50: ${p50}ms, P95: ${p95}ms`);
  console.log(`Simulated ${numUsers} active users, ~${(totalRequests / numUsers).toFixed(0)} requests per user`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
