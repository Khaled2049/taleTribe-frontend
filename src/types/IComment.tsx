export interface Comment {
  id: string;
  storyId: string;
  chapterId: string;
  message: string;
  userId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  username?: string;
  children?: Comment[];
}
