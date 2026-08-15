export interface CharacterRelationship {
  characterId: string;
  name: string;
  type: "ally" | "rival" | "mentor" | "love interest" | "family" | "neutral";
  description?: string;
}

export interface Character {
  id: string;
  name: string;
  age?: number;
  artUrl?: string;
  soul?: string;
  personality?: string;
  voice?: string;
  backstory?: string;
  affiliations?: string;
  notes?: string;
  relationships?: CharacterRelationship[];
  userId: string;
  revision?: number;
}
