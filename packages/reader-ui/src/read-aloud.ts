export type ReadAloudStatus = "idle" | "playing" | "paused" | "error";
export interface ReadAloudOptions {
  text: string;
  voice: string;
  speed: number;
  onError?: (message: string) => void;
}
export interface ReadAloudResult {
  status: ReadAloudStatus;
  voices: SpeechSynthesisVoice[];
  spokenRange: { start: number; end: number } | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
}
export type ReadAloudHook = (options: ReadAloudOptions) => ReadAloudResult;
const disabled: ReadAloudResult = {
  status: "idle",
  voices: [],
  spokenRange: null,
  play: async () => undefined,
  pause: () => undefined,
  stop: () => undefined,
};
export function useDisabledReadAloud(): ReadAloudResult {
  return disabled;
}
