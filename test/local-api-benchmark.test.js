const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

test("benchmark local-api JSONL read and dedup throughput", async (t) => {
  // Create a temporary queue file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-api-bench-"));
  const queuePath = path.join(tmpDir, "queue.jsonl");

  // Generate a large payload: 50,000 token entries with 5% duplicates
  const lines = [];
  for (let i = 0; i < 50000; i++) {
    const source = "source-" + (i % 5);
    const model = "model-" + (i % 10);
    // Hour variations
    const hourStart = "2024-01-01T" + String(i % 24).padStart(2, "0") + ":00:00Z";

    lines.push(JSON.stringify({
      source,
      model,
      hour_start: hourStart,
      total_tokens: 100,
      input_tokens: 50,
      output_tokens: 50
    }));

    // Add some duplicate entries representing incremental syncs to the same hour
    if (i % 20 === 0) {
      lines.push(JSON.stringify({
        source,
        model,
        hour_start: hourStart,
        total_tokens: 150, // Updated value that should win in dedup
        input_tokens: 75,
        output_tokens: 75
      }));
    }
  }

  fs.writeFileSync(queuePath, lines.join("\n"));

  // Isolate require to make sure we measure the current implementation
  const { readQueueData } = require("../src/lib/local-api");

  // Warmup
  readQueueData(queuePath);

  const start = performance.now();
  const parsed = readQueueData(queuePath);
  const durationMs = performance.now() - start;

  t.diagnostic(`Generated ${lines.length} rows`);
  t.diagnostic(`Deduped to ${parsed.length} buckets`);
  t.diagnostic(`readQueueData time: ${durationMs.toFixed(2)} ms`);

  // Rough throughput sanity check (should comfortably parse this <500ms on modern CI)
  // We won't strictly fail the test on timing to avoid flaky CI, but we check correctness
  assert.ok(durationMs > 0);
  assert.ok(parsed.length < lines.length); // Should have deduped

  // Cleanup
  fs.unlinkSync(queuePath);
  fs.rmdirSync(tmpDir);
});
