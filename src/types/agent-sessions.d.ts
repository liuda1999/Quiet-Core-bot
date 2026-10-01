// Declares extension points for agent session type augmentation.
export type QuietCoreAgentSessionSkillSourceAugmentation = never;

declare module "quiet-core-bot/plugin-sdk/agent-sessions" {
  interface Skill {
    // Quiet Core bot relies on the source identifier returned by skill loaders.
    source: string;
  }
}
