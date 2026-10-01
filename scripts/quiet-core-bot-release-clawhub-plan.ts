#!/usr/bin/env -S node --import tsx
// QuietCore release ClawHub plan CLI emits release workflow routing as JSON.

import { pathToFileURL } from "node:url";
import {
  buildQuietCoreReleaseClawHubPlan,
  parseQuietCoreReleaseClawHubPlanArgs,
} from "./lib/quiet-core-bot-release-clawhub-plan.ts";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseQuietCoreReleaseClawHubPlanArgs(process.argv.slice(2));
  const plan = await buildQuietCoreReleaseClawHubPlan(args);
  console.log(JSON.stringify(plan, null, 2));
}
