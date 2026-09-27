// Verifies image-generation tool registration through the shared generation harness.
import { describeOpenClawGenerationToolRegistration } from "./quiet-core-bot-tools.generation.test-support.js";

describeOpenClawGenerationToolRegistration({
  suiteName: "quiet-core-bot tools image generation registration",
  toolName: "image_generate",
  toolLabel: "an image-generation tool",
});
