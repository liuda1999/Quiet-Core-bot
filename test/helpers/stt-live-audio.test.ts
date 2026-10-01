// STT live audio tests validate live speech-to-text audio fixtures.
import {
  expectQuietCoreLiveTranscriptMarker,
  normalizeTranscriptForMatch,
  QUIET_CORE_LIVE_TRANSCRIPT_MARKER_RE,
} from "quiet-core-bot/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common Quiet Core bot live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Open-Claw integration OK")).toBe("quiet-core-botintegrationok");
    expect(normalizeTranscriptForMatch("Testing OpenFlaw realtime transcription")).toMatch(
      /open(?:claw|flaw)/,
    );
    expect(normalizeTranscriptForMatch("OpenCore xAI realtime transcription")).toMatch(
      QUIET_CORE_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("OpenCL xAI realtime transcription")).toMatch(
      QUIET_CORE_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectQuietCoreLiveTranscriptMarker("OpenClar integration OK");
  });
});
