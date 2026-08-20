import { WordDefinition } from "@/types/IReader";

class DictionaryService {
  private cache: Map<string, WordDefinition> = new Map();

  async lookup(word: string): Promise<WordDefinition> {
    // Check cache first
    if (this.cache.has(word)) {
      return this.cache.get(word)!;
    }

    try {
      // Using Free Dictionary API
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
          word,
        )}`,
      );

      if (!response.ok) {
        throw new Error("Word not found");
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error("No definition found");
      }

      const entry = data[0];
      const meaning = entry.meanings?.[0];
      const definition = meaning?.definitions?.[0];

      const result: WordDefinition = {
        word: entry.word,
        partOfSpeech: meaning?.partOfSpeech || "unknown",
        definition: definition?.definition || "No definition available",
        examples: definition?.example ? [definition.example] : [],
      };

      // Cache the result
      this.cache.set(word, result);

      return result;
    } catch (error) {
      console.error("Dictionary API error:", error);
      // Surface the failure honestly so the UI can show "no definition found"
      // rather than fabricating a fake definition.
      throw error instanceof Error ? error : new Error("Word lookup failed");
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

export const dictionaryService = new DictionaryService();
