// Verifies video-generation tool registration through the shared generation harness.
import { describeOpenClawGenerationToolRegistration } from "./quiet-core-bot-tools.generation.test-support.js";

describeOpenClawGenerationToolRegistration({
  suiteName: "quiet-core-bot tools video generation registration",
  toolName: "video_generate",
  toolLabel: "a video-generation tool",
});
