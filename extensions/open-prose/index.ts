// Open Prose plugin entrypoint registers its QuietCore integration.
import { definePluginEntry, type QuietCorePluginApi } from "./runtime-api.js";

export default definePluginEntry({
  id: "open-prose",
  name: "OpenProse",
  description: "Plugin-shipped prose skills bundle",
  register(_api: QuietCorePluginApi) {
    // OpenProse is delivered via plugin-shipped skills.
  },
});
