/**
 * @deprecated Compatibility surface for bundled channel schemas.
 *
 * Quiet Core bot-maintained bundled plugins should import
 * quiet-core-bot/plugin-sdk/bundled-channel-config-schema. Third-party plugins should
 * define plugin-local schemas and import primitives from
 * quiet-core-bot/plugin-sdk/channel-config-schema instead of depending on bundled
 * channel schemas.
 */
export * from "./bundled-channel-config-schema.js";
