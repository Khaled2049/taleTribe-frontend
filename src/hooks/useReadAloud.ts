import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Chapter read-aloud on the browser's native SpeechSynthesis API.
 *
 * This replaced an on-device Kokoro TTS model (ONNX Runtime + transformers.js),
 * which shipped ~54 MB of WASM in every build. The native API costs zero bytes;
 * the trade-off is that voice quality and the available voice list are whatever
 * the user's OS/browser provides.
 *
 * Text is spoken one sentence at a time rather than as a single utterance. That
 * gives sentence-level `spokenRange` highlighting, lets a voice/speed change
 * resume from the current sentence, and sidesteps the long-standing Chrome bug
 * where a single long utterance stops speaking after ~15 seconds.
 */

export type ReadAloudStatus = "idle" | "playing" | "paused" | "error";

export interface ReadAloudOptions {
  /** Plain text to read (chapter plainText). */
  text: string;
  /** `voiceURI` of the desired voice; falls back to the default when unknown. */
  voice: string;
  speed: number;
  onError?: (msg: string) => void;
}

interface Sentence {
  text: string;
  start: number;
  end: number;
}

const synth = (): SpeechSynthesis | null =>
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

/**
 * Split into sentences while tracking each one's offset in the original string,
 * so `spokenRange` can drive highlighting in the reader.
 */
function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  // Sentence-ending punctuation followed by whitespace, or a paragraph break.
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*|\n+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    if (!raw.trim()) continue;

    // Trim leading whitespace off the range so highlighting starts on a word.
    const leading = raw.length - raw.trimStart().length;
    const start = match.index + leading;
    const end = match.index + raw.trimEnd().length;
    if (end > start) out.push({ text: raw.trim(), start, end });
  }

  return out;
}

/** English voices, most useful first. */
function englishVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return all
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => {
      if (a.default !== b.default) return a.default ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function useReadAloud({
  text,
  voice,
  speed,
  onError,
}: ReadAloudOptions) {
  const [status, setStatus] = useState<ReadAloudStatus>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [spokenRange, setSpokenRangeState] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const spokenRangeRef = useRef<{ start: number; end: number } | null>(null);
  const setSpokenRange = useCallback(
    (range: { start: number; end: number } | null) => {
      spokenRangeRef.current = range;
      setSpokenRangeState(range);
    },
    [],
  );

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  voicesRef.current = voices;

  const voiceRef = useRef(voice);
  const speedRef = useRef(speed);
  const onErrorRef = useRef(onError);
  voiceRef.current = voice;
  speedRef.current = speed;
  onErrorRef.current = onError;

  const statusRef = useRef(status);
  statusRef.current = status;

  // Playback state (refs — never triggers renders).
  const sentencesRef = useRef<Sentence[]>([]);
  const indexRef = useRef(0);
  // Bumped by stop()/restart; invalidates callbacks from a superseded run.
  const epochRef = useRef(0);

  // Sentences are derived from text, not state — recompute when the text changes.
  useEffect(() => {
    sentencesRef.current = splitSentences(text);
    indexRef.current = 0;
  }, [text]);

  // ── Voice list ──────────────────────────────────────────────────────────────
  // getVoices() is populated asynchronously in most browsers; `voiceschanged`
  // fires once the list is ready (and again if the user installs a voice).
  useEffect(() => {
    const s = synth();
    if (!s) return;

    const load = () => setVoices(englishVoices(s.getVoices()));
    load();
    s.addEventListener("voiceschanged", load);
    return () => s.removeEventListener("voiceschanged", load);
  }, []);

  const resolveVoice = useCallback((): SpeechSynthesisVoice | null => {
    const available = voicesRef.current;
    if (available.length === 0) return null;
    // A stored voiceURI may no longer exist (different device, or a leftover
    // Kokoro id from the previous implementation) — fall back to the default.
    return (
      available.find((v) => v.voiceURI === voiceRef.current) ??
      available.find((v) => v.default) ??
      available[0]
    );
  }, []);

  // ── Playback ────────────────────────────────────────────────────────────────

  const speakFrom = useCallback(
    (index: number) => {
      const s = synth();
      if (!s) {
        setStatus("error");
        onErrorRef.current?.("This browser doesn't support speech synthesis.");
        return;
      }

      const sentences = sentencesRef.current;
      if (index >= sentences.length) {
        indexRef.current = 0;
        setSpokenRange(null);
        setStatus("idle");
        return;
      }

      const epoch = ++epochRef.current;
      indexRef.current = index;
      s.cancel();

      const speakAt = (i: number) => {
        if (epoch !== epochRef.current) return;
        const sentence = sentences[i];
        if (!sentence) {
          indexRef.current = 0;
          setSpokenRange(null);
          setStatus("idle");
          return;
        }

        indexRef.current = i;
        const utterance = new SpeechSynthesisUtterance(sentence.text);
        const selected = resolveVoice();
        if (selected) {
          utterance.voice = selected;
          utterance.lang = selected.lang;
        }
        utterance.rate = speedRef.current;

        utterance.onstart = () => {
          if (epoch !== epochRef.current) return;
          setSpokenRange({ start: sentence.start, end: sentence.end });
          setStatus("playing");
        };

        utterance.onend = () => {
          if (epoch !== epochRef.current) return;
          speakAt(i + 1);
        };

        utterance.onerror = (event) => {
          if (epoch !== epochRef.current) return;
          // `interrupted`/`canceled` are what cancel() raises — not real errors.
          if (event.error === "interrupted" || event.error === "canceled")
            return;
          setSpokenRange(null);
          setStatus("error");
          onErrorRef.current?.("Speech playback failed.");
        };

        s.speak(utterance);
      };

      speakAt(index);
    },
    [resolveVoice, setSpokenRange],
  );

  const stop = useCallback(() => {
    epochRef.current++;
    synth()?.cancel();
    indexRef.current = 0;
    setSpokenRange(null);
    setStatus("idle");
  }, [setSpokenRange]);

  const play = useCallback(async () => {
    const s = synth();
    if (!s) {
      setStatus("error");
      onErrorRef.current?.("This browser doesn't support speech synthesis.");
      return;
    }

    if (statusRef.current === "paused") {
      s.resume();
      setStatus("playing");
      return;
    }
    if (statusRef.current === "playing") return;

    if (sentencesRef.current.length === 0) {
      setStatus("idle");
      return;
    }
    speakFrom(indexRef.current);
  }, [speakFrom]);

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    synth()?.pause();
    setStatus("paused");
  }, []);

  // ── Voice / speed changes: restart from the current sentence ────────────────
  // Debounced so dragging the speed slider doesn't restart on every tick.
  useEffect(() => {
    if (statusRef.current === "idle" || statusRef.current === "error") return;

    const timer = setTimeout(() => {
      // Changing settings implies wanting to hear the result, even if paused.
      speakFrom(indexRef.current);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, speed]);

  // ── Text change (chapter navigation) and unmount: stop everything ───────────
  // Without this, speech keeps playing after the reader unmounts.
  useEffect(() => {
    return () => {
      stop();
    };
  }, [text, stop]);

  return {
    status,
    voices,
    spokenRange,
    play,
    pause,
    stop,
  };
}
