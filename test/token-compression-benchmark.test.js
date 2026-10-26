const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { performance } = require("node:perf_hooks");
const zstdFallback = require("@mongodb-js/zstd");

test("benchmark token serialization and compression throughput", async (t) => {
  // Generate high data volume: 100,000 token-like objects
  const payload = [];
  for (let i = 0; i < 100000; i++) {
    payload.push({
      id: `tok_${i}_${Date.now()}`,
      model: "claude-3-5-sonnet",
      input_tokens: Math.floor(Math.random() * 1000),
      output_tokens: Math.floor(Math.random() * 500),
      timestamp: new Date().toISOString(),
      tags: ["benchmark", "test", "serialization"]
    });
  }

  const startSer = performance.now();
  const jsonString = JSON.stringify(payload);
  const endSer = performance.now();

  const buffer = Buffer.from(jsonString, 'utf8');

  const startGzip = performance.now();
  const gzipResult = zlib.gzipSync(buffer);
  const endGzip = performance.now();

  let zstdResult;
  const startZstd = performance.now();
  if (typeof zlib.zstdCompressSync === "function") {
    zstdResult = zlib.zstdCompressSync(buffer);
  } else {
    zstdResult = await zstdFallback.compress(buffer);
  }
  const endZstd = performance.now();

  const serTime = endSer - startSer;
  const gzipTime = endGzip - startGzip;
  const zstdTime = endZstd - startZstd;

  t.diagnostic(`Payload size: ${payload.length} objects`);
  t.diagnostic(`JSON size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  t.diagnostic(`Serialization time: ${serTime.toFixed(2)} ms`);
  t.diagnostic(`Gzip time: ${gzipTime.toFixed(2)} ms (Size: ${(gzipResult.length / 1024 / 1024).toFixed(2)} MB)`);
  t.diagnostic(`Zstd time: ${zstdTime.toFixed(2)} ms (Size: ${(zstdResult.length / 1024 / 1024).toFixed(2)} MB)`);

  assert.ok(serTime >= 0);
  assert.ok(gzipTime >= 0);
  assert.ok(zstdTime >= 0);
  assert.ok(gzipResult.length < buffer.length);
  assert.ok(zstdResult.length < buffer.length);
});
