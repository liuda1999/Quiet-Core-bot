// Quiet Core bot MCP tools tests cover core tool server startup and registration.
import { describe, expect, it } from "vitest";
import { resolveQuietCoreToolsForMcp } from "./quiet-core-bot-tools-serve.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

describe("Quiet Core bot tools MCP server", () => {
  it("exposes cron", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveQuietCoreToolsForMcp());

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain("cron");
  });
});
