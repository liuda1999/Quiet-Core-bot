// Guards post-compaction config schema behavior against regressions.
import { describe, expect, it } from "vitest";
import { ToolsSchema } from "./zod-schema.agent-runtime.js";
import { QuietCoreSchema } from "./zod-schema.js";

describe("QuietCoreSchema tools.loopDetection.postCompactionGuard validation", () => {
  it("accepts tools.loopDetection.postCompactionGuard configuration", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          enabled: true,
          postCompactionGuard: {
            windowSize: 5,
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty postCompactionGuard object", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          postCompactionGuard: {},
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys under tools.loopDetection.postCompactionGuard", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          postCompactionGuard: {
            windowSize: 3,
            bogus: "key",
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive windowSize", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          postCompactionGuard: {
            windowSize: 0,
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer windowSize", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          postCompactionGuard: {
            windowSize: 2.5,
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("validates via ToolsSchema directly", () => {
    const result = ToolsSchema.safeParse({
      loopDetection: {
        postCompactionGuard: { windowSize: 4 },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("QuietCoreSchema tools.loopDetection.singleStepConcurrent validation (A17/A23)", () => {
  it("accepts a valid singleStepConcurrent configuration", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {
            enabled: true,
            criticalThreshold: 20,
            breakerThreshold: 30,
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts singleStepConcurrent defaults shape (all optional)", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {},
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts only callers enabled without thresholds", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: { enabled: true },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys under singleStepConcurrent", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {
            enabled: true,
            bogus: "key",
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects criticalThreshold >= breakerThreshold", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {
            enabled: true,
            criticalThreshold: 30,
            breakerThreshold: 20,
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects equal critical and breaker thresholds", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {
            criticalThreshold: 20,
            breakerThreshold: 20,
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive thresholds", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {
            criticalThreshold: 0,
            breakerThreshold: 30,
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer thresholds", () => {
    const result = QuietCoreSchema.safeParse({
      tools: {
        loopDetection: {
          singleStepConcurrent: {
            criticalThreshold: 20.5,
            breakerThreshold: 30,
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("validates via ToolsSchema directly", () => {
    const result = ToolsSchema.safeParse({
      loopDetection: {
        singleStepConcurrent: {
          enabled: true,
          criticalThreshold: 20,
          breakerThreshold: 30,
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
