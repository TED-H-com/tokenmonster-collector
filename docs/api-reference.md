# API Reference and Developer Usage

This document outlines the core modules of Token Tracker, their API specifications, and usage examples. Token Tracker collects token usage from various AI coding tools locally without acting as a proxy.

## Core Modules

The codebase strictly separates modules: use CommonJS in `src/` and ESM with strict TypeScript in `dashboard/`. Do not mix them.

### `src/lib/local-api.js`

This module provides the local HTTP API endpoints that serve the dashboard, macOS menu bar app, and desktop widgets with aggregated token data.

**Key API Endpoints:**

*   `GET /functions/tokentracker-usage-summary`: Returns daily aggregated token usage, cost, and historical trends for a specified date range.
*   `GET /functions/tokentracker-usage-daily`: Returns token usage grouped by day.
*   `GET /functions/tokentracker-usage-heatmap`: Returns GitHub-style heatmap data (weekly chunks of daily token usage).
*   `GET /functions/tokentracker-usage-model-breakdown`: Returns token usage grouped by model and source.
*   `GET /functions/tokentracker-project-usage-summary`: Returns token usage aggregated by project directory or git repository.
*   `GET /functions/tokentracker-achievements`: Returns the user's progress on local achievements (e.g., Night Owl, Project Devotion).
*   `POST /functions/tokentracker-local-sync`: Triggers a manual sync of local log files from supported AI tools into the Token Tracker database.
*   `GET /functions/tokentracker-wrapped`: Computes a year-end summary of token usage.
*   `GET /functions/tokentracker-skills`: Lists, searches, installs, or tracks usage of AI skills.

**Usage Example:**

```javascript
// Starting the local server (internal usage)
const { createLocalApiHandler } = require('./src/lib/local-api');
const http = require('http');

const handler = createLocalApiHandler({});
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const handled = await handler(req, res, url);
    if (!handled) {
        res.writeHead(404);
        res.end("Not Found");
    }
});
server.listen(7680);
```

### `src/lib/skill-usage.js`

This module handles tool usage event scanning (e.g., Claude skills). It parses transcript files to track which installed skills are invoked and attributes token usage evenly across the skills used in a turn.

**Usage Example:**

```javascript
const { scanSkillUsage } = require('./src/lib/skill-usage');

async function checkSkills() {
    const usage = await scanSkillUsage();
    console.log(`Scanned ${usage.scannedFiles} files.`);
    console.log(`Total skill invocations: ${usage.totalInvocations}`);
    for (const skill of usage.skills) {
        console.log(`Skill: ${skill.skill} used ${skill.invocations} times`);
    }
}
```

### `src/lib/wrapped-aggregator.js`

This module processes local `queue.jsonl` rows to generate a year-end "Wrapped" summary (daily streaks, peak flow hours, top models, and total tokens).

**Usage Example:**

```javascript
const { aggregateWrapped } = require('./src/lib/wrapped-aggregator');

const rows = [
    { source: "claude", model: "claude-3-5-sonnet", hour_start: "2024-10-01T14:00:00Z", total_tokens: 5000 },
    { source: "cursor", model: "gpt-4o", hour_start: "2024-10-02T15:00:00Z", total_tokens: 3000 }
];

const summary = aggregateWrapped(rows, { year: 2024 });
console.log(`Total tokens in 2024: ${summary.totals.tokens}`);
console.log(`Active days: ${summary.totals.active_days}`);
```
