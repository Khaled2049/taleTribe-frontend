import { User as FirebaseUser } from "firebase/auth";

export interface IUser extends FirebaseUser {
  username: string;
  firstName?: string;
  lastName?: string;
  followers: string[];
  following: string[];
  createdAt: string;
  lastLogin: string;
  occupation: string;
  bio: string;
  location: string;
  writingInterests?: string;
  walletAddress?: string;
  hasCustomAiProvider?: boolean;
  isAdmin?: boolean;
  aiUsage?: number;
  lastAiUsageDate?: string;
}
