// Qa Lab resolves the private QA channel protocol surface lazily.
//
// `quiet-core-bot/plugin-sdk/qa-channel-protocol` is a private local-only subpath
// that only resolves in a private QA build (`QUIET_CORE_BUILD_PRIVATE_QA=1`). A
// static import would make bus-state (and every module that imports it) fail to
// load in default builds, so the surface is resolved at load time and a missing
// capability surfaces as an actionable error instead of a module-resolution crash.

import { QaChannelUnavailableError } from "./qa-channel-loader.js";

export type QaChannelProtocolModule =
  typeof import("quiet-core-bot/plugin-sdk/qa-channel-protocol");

let qaChannelProtocolModule: QaChannelProtocolModule | null = null;
let qaChannelProtocolModulePromise: Promise<QaChannelProtocolModule> | null = null;

/** Load (and cache) the private QA protocol surface, or throw a diagnosable error. */
export async function loadQaChannelProtocolModule(): Promise<QaChannelProtocolModule> {
  if (qaChannelProtocolModule) {
    return qaChannelProtocolModule;
  }
  qaChannelProtocolModulePromise ??= import("quiet-core-bot/plugin-sdk/qa-channel-protocol").then(
    (module) => {
      const loaded = module;
      qaChannelProtocolModule = loaded;
      return loaded;
    },
    (error: unknown) => {
      qaChannelProtocolModulePromise = null;
      throw new QaChannelUnavailableError({ cause: error });
    },
  );
  return await qaChannelProtocolModulePromise;
}

/**
 * Synchronous accessor for callers that cannot await (bus-state message creation
 * is a synchronous API). Accessing it before the private surface is loaded
 * throws QaChannelUnavailableError.
 */
export function getQaChannelProtocolModule(): QaChannelProtocolModule {
  if (!qaChannelProtocolModule) {
    throw new QaChannelUnavailableError();
  }
  return qaChannelProtocolModule;
}

// Start resolving the private surface at module load so synchronous callers can
// use it once the import settles; a missing entrypoint degrades to the error
// above at use time instead of crashing module resolution.
void loadQaChannelProtocolModule().catch(() => undefined);
