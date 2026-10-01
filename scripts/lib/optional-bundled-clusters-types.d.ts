// Optional Bundled Clusters Types.D script supports QuietCore repository automation.
export const optionalBundledClusterSet: Set<string>;
export function shouldBuildBundledCluster(
  cluster: string,
  env?: NodeJS.ProcessEnv,
  options?: { packageJson?: unknown },
): boolean;
