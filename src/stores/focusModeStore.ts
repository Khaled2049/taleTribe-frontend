import { create } from "zustand";

interface FocusModeState {
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
}

export const useFocusModeStore = create<FocusModeState>((set) => ({
  focusMode: false,
  setFocusMode: (value) => set({ focusMode: value }),
}));
