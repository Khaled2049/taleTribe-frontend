import { auth, firestore } from "@/config/firebase";
import { IBookOfTheMonth, IClub, IDiscussionPrompt, IPoll, IReadingProgress, IReadingSchedule, IPromptResponse } from "@/types/IClub";
import { IMessage } from "@/types/IMessage";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { RATE_LIMITS } from "@/config/rateLimits";

const baseURL = import.meta.env.VITE_STORY_DATA_URL || "/story-data";

class BookClubRepo {
  private async request<T>(method: string, path: string, body?: unknown, required = false): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const user = auth.currentUser;
    if (required && !user) throw new Error("You must be signed in.");
    if (user) { const token = await user.getIdToken(); if (token) headers.Authorization = `Bearer ${token}`; if (import.meta.env.DEV) headers["X-User-ID"] = user.uid; }
    const response = await fetch(`${baseURL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Book club request failed (${response.status})`); }
    const result = response.status === 204 ? undefined as T : await response.json() as T;
    if (method !== "GET") window.dispatchEvent(new Event("book-club-changed"));
    return result;
  }

  createBookClub(club: IClub): Promise<string> { return this.request<IClub>("POST", "/v1/book-clubs", club, true).then((x) => x.id); }
  getBookClubs(): Promise<IClub[]> { return this.request<IClub[]>("GET", "/v1/book-clubs"); }
  getBookClub(id: string): Promise<IClub | undefined> { return this.request<IClub>("GET", `/v1/book-clubs/${id}`).catch((e) => { if (e.message === "not found") return undefined; throw e; }); }
  updateBookClub(id: string, club: IClub) { return this.request<IClub>("PATCH", `/v1/book-clubs/${id}`, club, true); }
  updateMeetUp(id: string, meetUp: string) { return this.settings(id, { meetUp }); }
  updateBookOfTheMonth(id: string, book: IBookOfTheMonth) { return this.settings(id, { bookOfTheMonth: book }); }
  private settings(id: string, body: object) { return this.request<IClub>("PATCH", `/v1/book-clubs/${id}/settings`, body, true); }
  deleteBookClub(id: string) { return this.request<void>("DELETE", `/v1/book-clubs/${id}`, undefined, true); }
  joinBookClub(id: string, _userId: string) { return this.request<void>("PUT", `/v1/book-clubs/${id}/members/me`, undefined, true); }
  leaveBookClub(id: string, _userId: string) { return this.request<void>("DELETE", `/v1/book-clubs/${id}/members/me`, undefined, true); }

  // Chat intentionally remains in Firebase for realtime delivery during this migration phase.
  async sendMessage(clubId: string, message: IMessage): Promise<string> {
    if (message.content.length > RATE_LIMITS.MAX_MESSAGE_SIZE_CHARS) throw new Error(`Message is too long. Maximum ${RATE_LIMITS.MAX_MESSAGE_SIZE_CHARS} characters allowed.`);
    const ref = doc(collection(firestore, `bookClubs/${clubId}/messages`));
    const clean = { ...message, spoilerChapterRange: message.spoilerChapterRange?.end === undefined ? (message.spoilerChapterRange ? { start: message.spoilerChapterRange.start } : undefined) : message.spoilerChapterRange };
    await setDoc(ref, { ...clean, id: ref.id, timestamp: serverTimestamp() }); return ref.id;
  }
  getMessages(clubId: string, callback: (messages: IMessage[]) => void) { return onSnapshot(query(collection(firestore, `bookClubs/${clubId}/messages`), orderBy("timestamp", "desc"), limit(50)), (snapshot) => callback(snapshot.docs.map((x) => x.data() as IMessage).reverse())); }
  addSpoilerToMessage(clubId: string, messageId: string, spoilerData: { chapterRange: { start: number; end?: number } }) { return updateDoc(doc(firestore, `bookClubs/${clubId}/messages`, messageId), { hasSpoiler: true, spoilerChapterRange: spoilerData.chapterRange }); }

  createReadingSchedule(id: string, schedule: IReadingSchedule) { return this.settings(id, { readingSchedule: schedule }); }
  updateReadingSchedule(id: string, schedule: IReadingSchedule) { return this.settings(id, { readingSchedule: schedule }); }
  createDiscussionPrompt(id: string, prompt: Omit<IDiscussionPrompt, "id">) { return this.request<IDiscussionPrompt>("POST", `/v1/book-clubs/${id}/prompts`, prompt, true).then((x) => x.id); }
  addPromptResponse(id: string, promptId: string, response: Omit<IPromptResponse, "id">) { return this.request<IPromptResponse>("POST", `/v1/book-clubs/${id}/prompts/${promptId}/responses`, response, true).then((x) => x.id); }
  createPoll(id: string, poll: Omit<IPoll, "id">) { return this.request<IPoll>("POST", `/v1/book-clubs/${id}/polls`, poll, true).then((x) => x.id); }
  voteOnPoll(id: string, pollId: string, _userId: string, optionIndex: number) { return this.request<void>("PUT", `/v1/book-clubs/${id}/polls/${pollId}/vote`, { optionIndex }, true); }
  closePoll(id: string, pollId: string) { return this.request<void>("PUT", `/v1/book-clubs/${id}/polls/${pollId}/close`, undefined, true); }
  updateReadingProgress(id: string, _userId: string, currentChapter: number, notes?: string) { return this.request<IReadingProgress>("PUT", `/v1/book-clubs/${id}/progress/me`, { currentChapter, notes: notes || null }, true); }
  getMemberProgress(id: string) { return this.request<IReadingProgress[]>("GET", `/v1/book-clubs/${id}/progress`, undefined, true); }
}
export const bookClubRepo = new BookClubRepo();
