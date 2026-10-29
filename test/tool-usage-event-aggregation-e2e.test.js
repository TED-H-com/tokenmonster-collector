const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const { scanSkillUsage } = require("../src/lib/skill-usage");
const { computeLocalAchievements } = require("../src/lib/local-api");
const { aggregateWrapped } = require("../src/lib/wrapped-aggregator");

function makeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "tt-e2e-tool-usage-"));
  fs.mkdirSync(path.join(home, ".claude", "projects", "proj1"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "projects", "proj2"), { recursive: true });
  return home;
}

function assistantLine({ id, ts, model, skills, usage }) {
  return JSON.stringify({
    type: "assistant",
    timestamp: ts,
    message: {
      id,
      model,
      usage,
      content: skills.map((skill, i) => ({
        type: "tool_use",
        id: `${id}-blk${i}`,
        name: "Skill",
        input: { skill },
      })),
    },
  });
}

describe("E2E Integration: Tool usage event aggregation, daily cost, and achievements", () => {
  it("parses Claude tool events, aggregates cost, and unlocks achievements", async () => {
    const home = makeHome();
    const proj1Dir = path.join(home, ".claude", "projects", "proj1");
    const proj2Dir = path.join(home, ".claude", "projects", "proj2");

    // 1. Generate Tool Usage Events (Claude Transcripts)
    const turn1 = assistantLine({
      id: "msg1",
      ts: "2026-08-01T02:00:00.000Z", // Night owl hour (02:00 UTC)
      model: "claude-3-5-sonnet-20240620",
      skills: ["bash", "file_editor"],
      usage: { input_tokens: 1000, output_tokens: 500 },
    });

    const turn2 = assistantLine({
      id: "msg2",
      ts: "2026-08-01T03:00:00.000Z", // Night owl hour
      model: "claude-3-5-sonnet-20240620",
      skills: ["bash"],
      usage: { input_tokens: 2000, output_tokens: 1000 },
    });

    const turn3 = assistantLine({
      id: "msg3",
      ts: "2026-08-02T14:00:00.000Z",
      model: "claude-3-5-sonnet-20240620",
      skills: ["grep"],
      usage: { input_tokens: 1000000, output_tokens: 200000 }, // High token usage for cost/devotion
    });

    fs.writeFileSync(path.join(proj1Dir, "session1.jsonl"), `${turn1}\n${turn2}\n`);
    fs.writeFileSync(path.join(proj2Dir, "session2.jsonl"), `${turn3}\n`);

    // 2. Scan Skill Usage (Event Stream Parsing)
    const skillResult = await scanSkillUsage({ home, force: true });

    assert.equal(skillResult.totalInvocations, 4, "4 tool uses across 3 turns");
    const byName = Object.fromEntries(skillResult.skills.map((s) => [s.skill, s]));
    assert.ok(byName["bash"]);
    assert.ok(byName["file_editor"]);
    assert.ok(byName["grep"]);

    // 3. Prepare Queue and Project Rows for Aggregation/Achievements
    // Simulate what the rollout parser would generate from these sessions
    const queueRows = [
      { source: "claude", model: "claude-3-5-sonnet-20240620", hour_start: "2026-08-01T02:00:00.000Z", total_tokens: 1500, input_tokens: 1000, output_tokens: 500, conversation_count: 1 },
      { source: "claude", model: "claude-3-5-sonnet-20240620", hour_start: "2026-08-01T03:00:00.000Z", total_tokens: 3000, input_tokens: 2000, output_tokens: 1000, conversation_count: 0 },
      { source: "claude", model: "claude-3-5-sonnet-20240620", hour_start: "2026-08-02T14:00:00.000Z", total_tokens: 1200000, input_tokens: 1000000, output_tokens: 200000, conversation_count: 1 }
    ];

    const projectRows = [
      { project_key: "proj1", source: "claude", hour_start: "2026-08-01T02:00:00.000Z", total_tokens: 1500 },
      { project_key: "proj1", source: "claude", hour_start: "2026-08-01T03:00:00.000Z", total_tokens: 3000 },
      { project_key: "proj2", source: "claude", hour_start: "2026-08-02T14:00:00.000Z", total_tokens: 1200000 }
    ];

    // 4. Verify Daily Cost Aggregation (via wrapped-aggregator)
    const wrapped = aggregateWrapped(queueRows);

    assert.equal(wrapped.totals.tokens, 1204500);
    assert.equal(wrapped.totals.active_days, 2);
    assert.equal(wrapped.longest_streak.days, 2);

    // 5. Verify Achievement Trigger Criteria
    const timeZoneContext = { timeZone: "UTC", offsetMinutes: 0 };
    const achievements = computeLocalAchievements(queueRows, projectRows, { timeZoneContext });

    const devotion = achievements.find(a => a.id === "project_devotion");
    assert.ok(devotion.metric_value >= 1000000, "Should have over 1M tokens on proj2");
    assert.ok(devotion.tier >= 1, "Should unlock at least bronze tier for project devotion");

    const nightOwl = achievements.find(a => a.id === "night_owl");
    // 02:00 and 03:00 UTC are night owl hours in UTC
    assert.equal(nightOwl.metric_value, 2, "Should have 2 night owl hours");

    const hopper = achievements.find(a => a.id === "project_hopper");
    assert.equal(hopper.metric_value, 2, "Should have 2 distinct projects");

    fs.rmSync(home, { recursive: true, force: true });
  });
});
