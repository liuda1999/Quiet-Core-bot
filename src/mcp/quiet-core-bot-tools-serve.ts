/**
 * Standalone MCP server for selected built-in Quiet Core bot tools.
 *
 * Run via: node --import tsx src/mcp/quiet-core-bot-tools-serve.ts
 * Or: bun src/mcp/quiet-core-bot-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveQuietCoreToolsForMcp(): AnyAgentTool[] {
  return [createCronTool({ creatorToolAllowlist: [{ name: "cron" }] })];
}

function createQuietCoreToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveQuietCoreToolsForMcp();
  return createToolsMcpServer({ name: "quiet-core-bot-tools", tools });
}

async function serveQuietCoreToolsMcp(): Promise<void> {
  const server = createQuietCoreToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveQuietCoreToolsMcp().catch((err: unknown) => {
    process.stderr.write(`quiet-core-bot-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
