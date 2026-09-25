/** ACP runtime error exports wired to Quiet Core bot secret redaction. */
import { configureAcpErrorRedactor } from "@openclaw/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

// Ensure ACP-core runtime errors use Quiet Core bot's secret redaction before re-export.
configureAcpErrorRedactor(redactSensitiveText);

export * from "@openclaw/acp-core/runtime/errors";
