"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const crypto = require("node:crypto");
const {
  getOrCreateMachineId,
  computeStableMachineId,
  isLinuxContainer,
  isValidLinuxMachineId,
  defaultSeedPath,
} = require("../src/lib/machine-id");

describe("machine-id", () => {
  let tempHome;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "tt-machine-id-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("defaultSeedPath computes path correctly", () => {
    const queuePath = path.join(tempHome, ".tokentracker", "tracker", "queue.jsonl");
    const seedPath = defaultSeedPath(queuePath);
    assert.equal(seedPath, path.join(tempHome, ".config", "tokentracker", "machine-id"));
  });

  it("isValidLinuxMachineId validates correctly", () => {
    assert.equal(isValidLinuxMachineId("0123456789abcdef0123456789abcdef"), true);
    assert.equal(isValidLinuxMachineId("00000000000000000000000000000000"), false); // all same char
    assert.equal(isValidLinuxMachineId("invalid_len"), false);
  });

  it("isLinuxContainer detects container via properties", () => {
    assert.equal(isLinuxContainer({ env: { container: "true" } }), true);
    assert.equal(isLinuxContainer({ env: {}, pathExists: (p) => p === "/.dockerenv" }), true);
    assert.equal(
      isLinuxContainer({
        env: {},
        pathExists: () => false,
        readFile: (p) => (p === "/proc/1/cgroup" ? "1:name=systemd:/docker/xyz" : "")
      }),
      true
    );
    assert.equal(
      isLinuxContainer({ env: {}, pathExists: () => false, readFile: () => "" }),
      false
    );
  });

  it("computeStableMachineId computes based on platform", () => {
    const mockDarwinExec = (cmd, args) => {
      return '"IOPlatformUUID" = "ABCDEF-1234"';
    };
    const macId = computeStableMachineId({
      platform: "darwin",
      execFile: mockDarwinExec,
      username: "testuser"
    });
    const expectedMacHash = crypto
      .createHash("sha256")
      .update(`tokentracker-machine-v1:ABCDEF-1234:testuser`)
      .digest("hex");
    assert.equal(macId, expectedMacHash);

    const mockLinuxReadFile = (p) => {
      if (p === "/etc/machine-id") return "11112222333344445555666677778888\n";
      return "";
    };
    const linuxId = computeStableMachineId({
      platform: "linux",
      env: {},
      pathExists: () => false,
      readFile: mockLinuxReadFile,
      username: "testuser"
    });
    const expectedLinuxHash = crypto
      .createHash("sha256")
      .update(`tokentracker-machine-v1:11112222333344445555666677778888:testuser`)
      .digest("hex");
    assert.equal(linuxId, expectedLinuxHash);

    const mockWinExec = () => "MachineGuid    REG_SZ    some-win-guid";
    const winId = computeStableMachineId({
      platform: "win32",
      execFile: mockWinExec,
      username: "testuser"
    });
    const expectedWinHash = crypto
      .createHash("sha256")
      .update(`tokentracker-machine-v1:some-win-guid:testuser`)
      .digest("hex");
    assert.equal(winId, expectedWinHash);
  });

  it("getOrCreateMachineId reads existing config.json", () => {
    const queuePath = path.join(tempHome, ".tokentracker", "tracker", "queue.jsonl");
    const configPath = path.join(path.dirname(queuePath), "config.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ machineId: "existing-machine-id" }));

    const id = getOrCreateMachineId(queuePath);
    assert.equal(id, "existing-machine-id");

    const seedPath = defaultSeedPath(queuePath);
    assert.equal(fs.readFileSync(seedPath, "utf8").trim(), "existing-machine-id");
  });

  it("getOrCreateMachineId falls back to seed file", () => {
    const queuePath = path.join(tempHome, ".tokentracker", "tracker", "queue.jsonl");
    const seedPath = defaultSeedPath(queuePath);
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(seedPath, "seed-machine-id");

    const id = getOrCreateMachineId(queuePath);
    assert.equal(id, "seed-machine-id");

    const configPath = path.join(path.dirname(queuePath), "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.equal(config.machineId, "seed-machine-id");
  });

  it("getOrCreateMachineId generates UUID when no seed or stableId", () => {
    const queuePath = path.join(tempHome, ".tokentracker", "tracker", "queue.jsonl");
    const id = getOrCreateMachineId(queuePath, { stableMachineId: null });
    assert.ok(typeof id === "string" && id.length > 8);

    const seedPath = defaultSeedPath(queuePath);
    assert.equal(fs.readFileSync(seedPath, "utf8").trim(), id);
  });
});
