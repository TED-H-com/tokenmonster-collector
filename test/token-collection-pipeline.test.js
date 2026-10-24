const assert = require("node:assert/strict");
const { test, describe, it } = require("node:test");
const { auditRows } = require("../scripts/audit-token-correctness.cjs");
const { getSourceScope } = require("../src/lib/source-metadata");

describe("Token Data Collection Pipeline", () => {
  it("schema validation passes for valid token collection data", () => {
    const validRow = {
      source: "gemini",
      model: "gemini-1.5-pro",
      hour_start: "2024-10-24T12:00:00.000Z",
      input_tokens: 15,
      output_tokens: 25,
      cached_input_tokens: 5,
      cache_creation_input_tokens: 10,
      reasoning_output_tokens: 0,
      total_tokens: 55,
      conversation_count: 1
    };

    const result = auditRows([validRow]);

    assert.equal(result.sources["gemini"].invariant_failures, 0, "Should have no invariant failures");
    assert.equal(result.sources["gemini"].total_tokens, 55, "Total tokens should match");
    assert.equal(result.sources["gemini"].input_tokens, 15, "Input tokens should match");
  });

  it("schema validation detects invariant failures when total tokens mismatch", () => {
    const invalidRow = {
      source: "gemini",
      model: "gemini-1.5-pro",
      hour_start: "2024-10-24T12:00:00.000Z",
      input_tokens: 15,
      output_tokens: 25,
      cached_input_tokens: 5,
      cache_creation_input_tokens: 10,
      reasoning_output_tokens: 0,
      total_tokens: 999, // Incorrect total
      conversation_count: 1
    };

    const result = auditRows([invalidRow]);

    assert.equal(result.sources["gemini"].invariant_failures, 1, "Should detect invariant failure");
  });

  it("pipeline handles missing fields gracefully", () => {
    const partialRow = {
      source: "gemini",
      model: "gemini-1.5-pro",
      hour_start: "2024-10-24T12:00:00.000Z",
      input_tokens: 15,
      output_tokens: 25,
      // missing cache and reasoning tokens
      total_tokens: 40,
      conversation_count: 1
    };

    const result = auditRows([partialRow]);

    assert.equal(result.sources["gemini"].invariant_failures, 0, "Should have no invariant failures for gracefully handled missing fields");
    assert.equal(result.sources["gemini"].total_tokens, 40, "Total tokens should match");
    assert.equal(result.sources["gemini"].cached_input_tokens, 0, "Missing fields should default to 0");
  });
});
