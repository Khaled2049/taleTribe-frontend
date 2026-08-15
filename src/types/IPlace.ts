export interface Place {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  atmosphere?: string;
  geography?: string;
  history?: string;
  significance?: string;
  notes?: string;
  userId: string;
  storyId?: string;
  revision?: number;
}
