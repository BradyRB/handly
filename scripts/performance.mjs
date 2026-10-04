const base = process.env.PERFORMANCE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Este smoke test solo usa el servidor local.");
const samples = [];
await fetch(`${base}/api/handly/search`);
for (let i = 0; i < 40; i++) {
  const start = performance.now();
  const response = await fetch(
    `${base}/api/handly/search?category=electricidad`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await response.json();
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      type: "local-search-smoke",
      count: samples.length,
      p50_ms: Math.round(samples[19]),
      p95_ms: Math.round(samples[37]),
      maximum_ms: Math.round(samples[39]),
      note: "Lecturas locales calientes; no certifica 2500 usuarios, cargas concurrentes ni disponibilidad.",
    },
    null,
    2,
  ),
);
