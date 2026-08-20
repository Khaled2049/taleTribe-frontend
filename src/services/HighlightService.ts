import { Highlight } from "@/types/IReader";

const STORAGE_KEY = "storyHighlights";

class HighlightService {
  private async getAllHighlights(): Promise<Highlight[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const highlights = JSON.parse(stored);
      // Convert date strings back to Date objects
      return highlights.map((h: any) => ({
        ...h,
        createdAt: new Date(h.createdAt),
      }));
    } catch (error) {
      console.error("Error loading highlights:", error);
      return [];
    }
  }

  private async saveAllHighlights(highlights: Highlight[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(highlights));
    } catch (error) {
      console.error("Error saving highlights:", error);
      throw error;
    }
  }

  async getByChapter(chapterId: string): Promise<Highlight[]> {
    const allHighlights = await this.getAllHighlights();
    return allHighlights.filter((h) => h.chapterId === chapterId);
  }

  async save(highlight: Highlight): Promise<Highlight> {
    const allHighlights = await this.getAllHighlights();
    allHighlights.push(highlight);
    await this.saveAllHighlights(allHighlights);
    return highlight;
  }

  async update(id: string, updates: Partial<Highlight>): Promise<Highlight> {
    const allHighlights = await this.getAllHighlights();
    const index = allHighlights.findIndex((h) => h.id === id);

    if (index === -1) {
      throw new Error("Highlight not found");
    }

    allHighlights[index] = { ...allHighlights[index], ...updates };
    await this.saveAllHighlights(allHighlights);

    return allHighlights[index];
  }

  async delete(id: string): Promise<void> {
    const allHighlights = await this.getAllHighlights();
    const filtered = allHighlights.filter((h) => h.id !== id);
    await this.saveAllHighlights(filtered);
  }

  async getAll(): Promise<Highlight[]> {
    return this.getAllHighlights();
  }

  async deleteByChapter(chapterId: string): Promise<void> {
    const allHighlights = await this.getAllHighlights();
    const filtered = allHighlights.filter((h) => h.chapterId !== chapterId);
    await this.saveAllHighlights(filtered);
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const highlightService = new HighlightService();
