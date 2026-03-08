/**
 * Simple load test: GET /banners (public) with concurrent requests.
 * Usage: node scripts/load-test.js [baseUrl] [total] [concurrency]
 * Example: node scripts/load-test.js http://localhost:4000 100 10
 */
const baseUrl = process.argv[2] || 'http://localhost:4000';
const total = parseInt(process.argv[3] || '100', 10) || 100;
const concurrency = parseInt(process.argv[4] || '10', 10) || 10;

const url = `${baseUrl.replace(/\/$/, '')}/banners`;

function request() {
  const start = Date.now();
  return fetch(url, { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : r.text()))
    .then(() => ({ ok: true, ms: Date.now() - start }))
    .catch((e) => ({ ok: false, ms: Date.now() - start, err: e.message }));
}

async function run() {
  console.log(`Load test: ${url}`);
  console.log(`Total: ${total}, Concurrency: ${concurrency}\n`);

  let completed = 0;
  let failed = 0;
  const latencies = [];

  const worker = async () => {
    while (completed < total) {
      const i = completed++;
      if (i >= total) break;
      const result = await request();
      if (!result.ok) failed++;
      latencies.push(result.ms);
    }
  };

  const start = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = Date.now() - start;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const rps = (latencies.length / elapsed) * 1000;

  console.log(`Completed: ${latencies.length}, Failed: ${failed}, Time: ${elapsed}ms`);
  console.log(`RPS: ${rps.toFixed(1)}, P50: ${p50}ms, P95: ${p95}ms`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
