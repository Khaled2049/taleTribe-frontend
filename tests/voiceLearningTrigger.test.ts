import { beforeEach, describe, expect, it } from "vitest";
import {
  VOICE_LEARNING_AFTER_PASS_MS,
  VOICE_LEARNING_AFTER_SKIP_MS,
  recordVoiceLearningRequest,
  recordVoiceLearningResult,
  resetVoiceLearningThrottle,
  shouldRequestVoiceLearning,
} from "@/components/editor/voiceLearningTrigger";

describe("voice learning trigger", () => {
  beforeEach(() => resetVoiceLearningThrottle());

  it("never asks when the cached profile has learning off", () => {
    expect(shouldRequestVoiceLearning("s1", 0, false)).toBe(false);
  });

  it("asks once, then waits out a skip before asking again", () => {
    expect(shouldRequestVoiceLearning("s1", 0, undefined)).toBe(true);
    recordVoiceLearningRequest("s1", 0);
    expect(shouldRequestVoiceLearning("s1", 5_000, true)).toBe(false);
    recordVoiceLearningResult("s1", 6_000, "skipped");
    expect(
      shouldRequestVoiceLearning("s1", VOICE_LEARNING_AFTER_SKIP_MS - 1, true),
    ).toBe(false);
    expect(
      shouldRequestVoiceLearning("s1", VOICE_LEARNING_AFTER_SKIP_MS, true),
    ).toBe(true);
  });

  it("waits the full server window after a pass ran", () => {
    recordVoiceLearningRequest("s1", 0);
    recordVoiceLearningResult("s1", 1_000, "analyzed");
    expect(
      shouldRequestVoiceLearning("s1", VOICE_LEARNING_AFTER_SKIP_MS, true),
    ).toBe(false);
    expect(
      shouldRequestVoiceLearning(
        "s1",
        1_000 + VOICE_LEARNING_AFTER_PASS_MS,
        true,
      ),
    ).toBe(true);
  });

  it("throttles each story separately", () => {
    recordVoiceLearningRequest("s1", 0);
    expect(shouldRequestVoiceLearning("s2", 0, undefined)).toBe(true);
  });
});
