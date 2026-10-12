import type { Highlight } from "../types/IReader.js";

export interface HighlightRepository {
  getByChapter(chapterId: string): Promise<Highlight[]>;
  save(highlight: Highlight): Promise<Highlight>;
  update(id: string, changes: Partial<Highlight>): Promise<Highlight>;
  delete(id: string): Promise<void>;
}
