# TokenTracker Architecture

## Collector Process Architecture
TokenTracker collects token usage from various AI coding tools (Claude Code, Codex, Cursor, Gemini, Kiro, OpenCode, OpenClaw, Every Code, Hermes, Copilot, Kimi Code, CodeBuddy, WorkBuddy, Grok Build, Kilo CLI, Kilo Code, Antigravity, oh-my-pi, pi, Craft, Roo, Zed, Goose, Droid, Mimo, ZCode, AnythingLLM) without acting as a proxy.

1. **Trigger Hooks**: AI CLI tools generate logs during normal use. Lightweight hooks detect changes and trigger sync. (Cursor uses an API instead of hooks).
2. **Log Parsing**: The Collector parses logs locally — never reading any prompt or response content, extracting only token counts and timestamps.
3. **Data Storage**: Parsed tokens are aggregated into 30-minute UTC buckets and stored in a local SQLite database (`queue.jsonl` or local storage depending on the component).
4. **Consumption**: The Dashboard, Menu Bar App, and Desktop Widgets read directly from this local snapshot.

## Desktop Widget IPC Protocol
The Desktop widgets and native applications (macOS and Windows) communicate with the embedded web dashboard using a lightweight IPC bridge.

**Native ↔ Web Bridge:**
- **JS to Native (Swift/C#)**: `window.webkit.messageHandlers.nativeBridge.postMessage({ type, key?, value?, name? })`
- **Native to JS (macOS/Swift)**: `NativeBridge.shared.handle(message:)` processes the message via `WKScriptMessageHandler`.
- **Response to JS**: `webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native:settings', { detail }))")`
- **React Consumption**: The React frontend uses a `useNativeSettings()` hook to subscribe to these events.

After registering/unregistering from the bridge (e.g. `SMAppService.mainApp.register`), the Native layer invokes a UI refresh (e.g., `launchAtLoginManager.refresh()`) to keep native menus in sync with the web UI state.

## CLI Configuration Options
Most users do not need manual configuration as TokenTracker relies on sensible defaults. For advanced setups, the following environment variables can modify the CLI behavior:

| Variable | Description | Default |
|---|---|---|
| `TOKENTRACKER_DEBUG` | Enable debug output (`1` to enable) | — |
| `TOKENTRACKER_NO_TELEMETRY` | Disable all anonymous telemetry (`1` to disable; `DO_NOT_TRACK` standard is also respected) | — |
| `TOKENTRACKER_HTTP_TIMEOUT_MS` | HTTP timeout in milliseconds | `20000` |
| `TOKENTRACKER_WSL_MODE` | WSL install resolution behavior on Windows (e.g., `wsl-first`, `native-first`, `wsl-only`, `native-only`, `both`) | `wsl-first` |
| `CODEX_HOME` | Override Codex CLI directory | `~/.codex` |
| `GEMINI_HOME` | Override Gemini CLI directory | `~/.gemini` |
| `TOKENTRACKER_GROK_HOME` | Override Grok Build directory for integration and Skills Manager | `~/.grok` |
| `GROK_HOME` | Legacy Grok Build directory override | `~/.grok` |
| `TOKENTRACKER_ANTIGRAVITY_HOME` | Force a single Antigravity Skills directory | auto |
