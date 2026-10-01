// Verifies image-generation tool registration through the shared generation harness.
import { describeQuietCoreGenerationToolRegistration } from "./quiet-core-bot-tools.generation.test-support.js";

describeQuietCoreGenerationToolRegistration({
  suiteName: "quiet-core-bot tools image generation registration",
  toolName: "image_generate",
  toolLabel: "an image-generation tool",
});
