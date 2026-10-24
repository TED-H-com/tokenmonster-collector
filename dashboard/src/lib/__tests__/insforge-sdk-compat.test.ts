// @vitest-environment node
import { Auth, HttpClient, TokenManager } from "@insforge/sdk";
import { describe, expect, it, vi } from "vitest";

const baseUrl = "https://auth.example.test";
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("InsForge SDK dependency compatibility", () => {
  it.each([
    ["Google", "/api/auth/oauth/google"],
    ["enterprise", "/api/auth/oauth/custom/enterprise"],
  ])("preserves the OAuth provider route for %s", async (provider, path) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ authUrl: "https://identity.example.test/authorize" }),
    );
    const tokenManager = new TokenManager();
    const auth = new Auth(new HttpClient({ baseUrl, fetch: fetchMock }, tokenManager), tokenManager);
    const result = await auth.signInWithOAuth({
      provider,
      redirectTo: "https://dashboard.example.test/callback",
      skipBrowserRedirect: true,
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      url: "https://identity.example.test/authorize",
      provider: provider.toLowerCase(),
    });
    expect(result.data.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.origin).toBe(baseUrl);
    expect(requestedUrl.pathname).toBe(path);
    expect(requestedUrl.searchParams.get("redirect_uri")).toBe("https://dashboard.example.test/callback");
    expect(requestedUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("refreshes a rejected access token and retries with the replacement bearer token", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "INVALID_TOKEN", message: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "replacement-token", user: { id: "test-user" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const tokenManager = new TokenManager();
    const http = new HttpClient({ baseUrl, fetch: fetchMock, autoRefreshToken: true, retryCount: 0 }, tokenManager);
    http.setAuthToken("expired-token");

    await expect(http.get("/api/test-resource")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname))
      .toEqual(["/api/test-resource", "/api/auth/sessions/current", "/api/test-resource"]);
    const [, refreshOptions] = fetchMock.mock.calls[1];
    expect(refreshOptions).toMatchObject({ method: "POST", credentials: "include" });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer expired-token");
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization")).toBe("Bearer replacement-token");
    expect(tokenManager.getAccessToken()).toBe("replacement-token");
  });
});
