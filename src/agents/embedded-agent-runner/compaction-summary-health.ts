/**
 * Detects a structurally valid but content-degenerate compaction summary.
 *
 * A compaction can report success while the summary it stored is unusable: when
 * the summarization model never receives the conversation (measured: a local
 * Ollama model silently truncating its prompt to the server default context) it
 * echoes the unfilled summarization template or asks for the conversation
 * instead of summarizing it. The transcript then gains a valid, parseable
 * `compaction` entry whose `summary` carries no context, so without this signal
 * "compaction succeeded but dropped the context" is invisible to the caller.
 *
 * Measured degenerate summaries (stage 4 batch 3 / 3.5, local Ollama):
 *   "Please provide the conversation content between the user and the AI coding
 *    assistant. Since the conversation was not included in your prompt, …
 *    ## Goal\n[Insert primary goals here] …"
 *   "Please provide the conversation text so I can generate the summary for
 *    you! … ## Goal\n[User's primary objectives] … [Requirement 1] …"
 *
 * This is a read-only advisory: it never throws and never changes the compaction
 * outcome (a degenerate summary is still reported as a successful compaction).
 */

/** The model asking for / describing the conversation it was supposed to read. */
const SUMMARY_META_ECHO_RES = [
  /provide the conversation/i,
  /conversation (?:content |text )?(?:was|is) not (?:included|provided)/i,
  /not (?:included|provided) in your prompt/i,
  /cannot (?:generate|produce|create) the summary/i,
];

/** Unambiguous unfilled template slot, e.g. `[Insert primary goals here]`. */
const SUMMARY_STRONG_SLOT_RE = /\[(?:insert|add|fill|placeholder)\b[^\n\]]{0,80}\]/i;

/**
 * Template-skeleton slots (e.g. `[User's primary objectives]`, `[Requirement 1]`).
 * A single one is not enough evidence — real summaries quote arbitrary bracketed
 * prose — so these only count as degenerate when several appear together.
 */
const SUMMARY_WEAK_SLOT_RE =
  /\[(?:user['’]?s?|your|completed|current|any|key|decision|requirement|objective|reasoning|primary|specific|next action|constraint|blocker)[^\n\]]{0,60}\]/gi;
const SUMMARY_WEAK_SLOT_MIN_MATCHES = 2;

/** A real summary is a paragraph; anything shorter carries no recoverable context. */
const DEGENERATE_SUMMARY_MIN_CHARS = 40;

export type DegenerateCompactionSummarySignal =
  | "missing_summary"
  | "placeholder_template"
  | "meta_instruction_echo"
  | "summary_too_short";

/**
 * D9: thrown by the compaction commit path when the produced summary is
 * degenerate (unfilled placeholder / meta-echo / too short). Distinct from a
 * generic compaction error so callers can refuse to let a context-free
 * placeholder replace the original transcript.
 */
export class CompactionDegenerateError extends Error {
  readonly signal?: DegenerateCompactionSummarySignal;
  readonly summaryChars: number;

  constructor(message: string, signal?: DegenerateCompactionSummarySignal, summaryChars = 0) {
    super(message);
    this.name = "CompactionDegenerateError";
    this.signal = signal;
    this.summaryChars = summaryChars;
  }
}

export function detectDegenerateCompactionSummary(summary: unknown): {
  degenerate: boolean;
  signal?: DegenerateCompactionSummarySignal;
  summaryChars: number;
} {
  if (typeof summary !== "string") {
    return { degenerate: true, signal: "missing_summary", summaryChars: 0 };
  }
  const summaryChars = summary.length;
  if (summary.trim().length === 0) {
    return { degenerate: true, signal: "missing_summary", summaryChars };
  }
  if (SUMMARY_STRONG_SLOT_RE.test(summary)) {
    return { degenerate: true, signal: "placeholder_template", summaryChars };
  }
  if (SUMMARY_META_ECHO_RES.some((re) => re.test(summary))) {
    return { degenerate: true, signal: "meta_instruction_echo", summaryChars };
  }
  const weakSlots = summary.match(SUMMARY_WEAK_SLOT_RE)?.length ?? 0;
  if (weakSlots >= SUMMARY_WEAK_SLOT_MIN_MATCHES) {
    return { degenerate: true, signal: "placeholder_template", summaryChars };
  }
  if (summaryChars < DEGENERATE_SUMMARY_MIN_CHARS) {
    return { degenerate: true, signal: "summary_too_short", summaryChars };
  }
  return { degenerate: false, summaryChars };
}
