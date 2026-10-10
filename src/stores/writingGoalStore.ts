import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dayKey, recordWords, type WritingGoalData } from "@/lib/writingGoal";

interface WritingGoalState extends WritingGoalData {
  setGoal: (goal: number | null) => void;
  record: (delta: number) => void;
  resetToday: () => void;
}

export const useWritingGoalStore = create<WritingGoalState>()(
  persist(
    (set) => ({
      goal: null,
      day: dayKey(new Date()),
      written: 0,
      setGoal: (goal) => set({ goal }),
      record: (delta) =>
        set((state) => recordWords(state, delta, dayKey(new Date()))),
      resetToday: () => set({ day: dayKey(new Date()), written: 0 }),
    }),
    { name: "writing-goal" },
  ),
);
