// Verifies PDF tool factory output is included in Quiet Core bot tool registration.
import { describe, expect, it } from "vitest";
import { collectPresentOpenClawTools } from "./quiet-core-bot-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createOpenClawTools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/quiet-core-bot-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentOpenClawTools([pdfTool]).map((tool) => tool.name)).toEqual(["pdf"]);
  });
});
