export interface Comment {
  id: string;
  storyId: string;
  message: string;
  userId: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorUsername: string;
  children?: Comment[];
}
