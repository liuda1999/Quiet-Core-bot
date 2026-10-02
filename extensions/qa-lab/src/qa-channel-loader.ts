// Qa Lab resolves the private QA channel plugin SDK surface lazily.
//
// `quiet-core-bot/plugin-sdk/qa-channel` is a private local-only subpath that
// only resolves in a private QA build (`QUIET_CORE_BUILD_PRIVATE_QA=1`). A static
// import here would make the whole qa-lab extension fail to load in default
// builds, so the surface is resolved at call time and a missing capability
// surfaces as an actionable error instead of a module-resolution crash.

export type QaChannelModule = typeof import("quiet-core-bot/plugin-sdk/qa-channel");

/** Raised when a qa-channel capability is requested without a private QA build. */
export class QaChannelUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super(
      [
        "The qa-channel capability is unavailable in this build.",
        "It requires the private QA SDK entrypoint quiet-core-bot/plugin-sdk/qa-channel,",
        "which is produced by a build with QUIET_CORE_BUILD_PRIVATE_QA=1",
        "(and enabled with QUIET_CORE_ENABLE_PRIVATE_QA_CLI=1).",
      ].join(" "),
      options,
    );
    this.name = "QaChannelUnavailableError";
  }
}

let qaChannelModule: QaChannelModule | null = null;
let qaChannelModulePromise: Promise<QaChannelModule> | null = null;

/** Load (and cache) the private QA channel SDK surface, or throw a diagnosable error. */
export async function loadQaChannelModule(): Promise<QaChannelModule> {
  if (qaChannelModule) {
    return qaChannelModule;
  }
  qaChannelModulePromise ??= import("quiet-core-bot/plugin-sdk/qa-channel").then(
    (module) => {
      const loaded = module;
      qaChannelModule = loaded;
      return loaded;
    },
    (error: unknown) => {
      qaChannelModulePromise = null;
      throw new QaChannelUnavailableError({ cause: error });
    },
  );
  return await qaChannelModulePromise;
}

/**
 * Wrap a qa-channel value in a lazy proxy so the module only loads on first access.
 * Accessing it before the private module is loaded throws QaChannelUnavailableError.
 */
export function createLazyQaChannelValue<T extends object>(
  select: (module: QaChannelModule) => T,
): T {
  return new Proxy({} as T, {
    get(_target, property, receiver) {
      if (!qaChannelModule) {
        throw new QaChannelUnavailableError();
      }
      const value = select(qaChannelModule);
      return Reflect.get(value, property, receiver);
    },
    has(_target, property) {
      return qaChannelModule ? Reflect.has(select(qaChannelModule), property) : false;
    },
  });
}
