export interface IMessage {
  id?: string;
  content: string;
  sender: string;
  senderId: string;
  timestamp?: { toDate(): Date };
  hasSpoiler?: boolean;
  spoilerChapterRange?: {
    start: number;
    end?: number;
  };
}
