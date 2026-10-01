// Device Pair API module exposes the plugin public contract.
export {
  approveDevicePairing,
  clearDeviceBootstrapTokens,
  issueDeviceBootstrapToken,
  PAIRING_SETUP_BOOTSTRAP_PROFILE,
  listDevicePairing,
  revokeDeviceBootstrapToken,
  type DeviceBootstrapProfile,
} from "quiet-core-bot/plugin-sdk/device-bootstrap";
export { definePluginEntry, type QuietCorePluginApi } from "quiet-core-bot/plugin-sdk/plugin-entry";
export {
  resolveGatewayBindUrl,
  resolveGatewayPort,
  resolveTailnetHostWithRunner,
} from "quiet-core-bot/plugin-sdk/core";
export {
  resolvePreferredQuietCoreTmpDir,
  runPluginCommandWithTimeout,
} from "quiet-core-bot/plugin-sdk/sandbox";
export { renderQrPngBase64, renderQrPngDataUrl, writeQrPngTempFile } from "./qr-image.js";
