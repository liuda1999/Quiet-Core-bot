/** ACP protocol helpers and Quiet Core bot agent identity metadata. */
export { normalizeAcpProvenanceMode } from "@quiet-core/acp-core/types";
import { VERSION } from "../version.js";

/** ACP agent identity advertised during protocol initialization. */
export const ACP_AGENT_INFO = {
  name: "quiet-core-bot-acp",
  title: "Quiet Core bot ACP Gateway",
  version: VERSION,
};
