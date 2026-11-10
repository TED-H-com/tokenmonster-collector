"use strict";

const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { resolveTrackerPaths } = require("../src/lib/tracker-paths");

describe("tracker-paths", () => {
  it("resolves paths using default homedir", async () => {
    const defaultHome = os.homedir();
    const paths = await resolveTrackerPaths();

    assert.equal(paths.rootDir, path.join(defaultHome, ".tokentracker"));
    assert.equal(paths.trackerDir, path.join(defaultHome, ".tokentracker", "tracker"));
    assert.equal(paths.binDir, path.join(defaultHome, ".tokentracker", "bin"));
    assert.equal(paths.cacheDir, path.join(defaultHome, ".tokentracker", "cache"));
  });

  it("resolves paths using explicit homedir", async () => {
    const explicitHome = "/tmp/fake-home";
    const paths = await resolveTrackerPaths({ home: explicitHome });

    assert.equal(paths.rootDir, path.join(explicitHome, ".tokentracker"));
    assert.equal(paths.trackerDir, path.join(explicitHome, ".tokentracker", "tracker"));
    assert.equal(paths.binDir, path.join(explicitHome, ".tokentracker", "bin"));
    assert.equal(paths.cacheDir, path.join(explicitHome, ".tokentracker", "cache"));
  });
});
