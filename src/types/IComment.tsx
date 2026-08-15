export interface Comment {
  id: string;
  storyId: string;
  chapterId: string;
  message: string;
  userId: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
  updatedAt: Date;
  username?: string;
  children?: Comment[];
}
