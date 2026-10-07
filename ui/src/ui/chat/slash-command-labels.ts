// Localized slash-command labels for the Control UI.
// Descriptions come from the shared command registry (English); the UI overlays
// translations when a locale provides them and otherwise keeps the registry text.
import { t } from "../../i18n/index.ts";
import {
  CATEGORY_LABELS,
  type SlashCommandCategory,
  type SlashCommandDef,
} from "./slash-commands.ts";

function localized(key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

/** Localized slash-command description, falling back to the registry text. */
export function slashCommandDescription(command: SlashCommandDef): string {
  return localized(`chat.slashCommands.${command.name}.description`, command.description);
}

/** Localized slash-command menu category label, falling back to the English label. */
export function slashCommandCategoryLabel(category: SlashCommandCategory): string {
  return localized(`chat.slashCommandCategories.${category}`, CATEGORY_LABELS[category]);
}
