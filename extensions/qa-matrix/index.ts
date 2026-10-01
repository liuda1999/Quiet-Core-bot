// Qa Matrix plugin entrypoint registers its QuietCore integration.
import { definePluginEntry } from "quiet-core-bot/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "qa-matrix",
  name: "QA Matrix",
  description: "Matrix QA transport runner and substrate",
  register() {},
});
