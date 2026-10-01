// Verifies video-generation tool registration through the shared generation harness.
import { describeQuietCoreGenerationToolRegistration } from "./quiet-core-bot-tools.generation.test-support.js";

describeQuietCoreGenerationToolRegistration({
  suiteName: "quiet-core-bot tools video generation registration",
  toolName: "video_generate",
  toolLabel: "a video-generation tool",
});
