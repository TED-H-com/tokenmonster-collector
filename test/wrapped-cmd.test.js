"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { cmdWrapped } = require("../src/commands/wrapped");

describe("cmdWrapped integration", () => {
  let tempHome;
  let originalStdoutWrite;
  let originalHomeDir;
  let stdoutData;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "tt-wrapped-cmd-test-"));
    // Override homedir for the test
    originalHomeDir = os.homedir;
    os.homedir = () => tempHome;

    stdoutData = "";
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      stdoutData += chunk;
      return true;
    };
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    fs.rmSync(tempHome, { recursive: true, force: true });
    os.homedir = originalHomeDir;
  });

  it("prints missing data message when queue is missing", async () => {
    await cmdWrapped([]);
    assert.ok(stdoutData.includes("No queue data found yet. Run `tracker sync` first"));
  });

  it("prints json error when queue is missing and --json is provided", async () => {
    await cmdWrapped(["--json"]);
    assert.ok(stdoutData.includes('"error": "no data"'));
  });

  it("throws on invalid --year", async () => {
    await assert.rejects(cmdWrapped(["--year", "1999"]), /expects a 4-digit year/);
    await assert.rejects(cmdWrapped(["--year", "200a"]), /expects a 4-digit year/);
  });

  it("throws on unknown option", async () => {
    await assert.rejects(cmdWrapped(["--unknown"]), /Unknown option/);
  });

  it("renders ascii when rows exist", async () => {
    const queueDir = path.join(tempHome, ".tokentracker", "tracker");
    fs.mkdirSync(queueDir, { recursive: true });
    const row = {
      source: "claude",
      model: "claude-3-5-sonnet",
      hour_start: "2026-04-01T10:00:00.000Z",
      total_tokens: 100,
      conversation_count: 1
    };
    fs.writeFileSync(path.join(queueDir, "queue.jsonl"), JSON.stringify(row) + "\n");

    await cmdWrapped([]);
    assert.ok(stdoutData.includes("TokenTracker Wrapped"));
    assert.ok(stdoutData.includes("═")); // border
    assert.ok(stdoutData.includes("100"));
  });

  it("renders json when rows exist and --json is provided", async () => {
    const queueDir = path.join(tempHome, ".tokentracker", "tracker");
    fs.mkdirSync(queueDir, { recursive: true });
    const row = {
      source: "claude",
      model: "claude-3-5-sonnet",
      hour_start: "2026-04-01T10:00:00.000Z",
      total_tokens: 100,
      conversation_count: 1
    };
    fs.writeFileSync(path.join(queueDir, "queue.jsonl"), JSON.stringify(row) + "\n");

    await cmdWrapped(["--json"]);
    assert.ok(stdoutData.includes('"tokens": 100'));
    assert.ok(stdoutData.includes('"year": 2026'));
  });
});
