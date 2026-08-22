import { useReaderSettingsStore } from "@/stores";

export const useReaderSettings = () => {
  const settings = useReaderSettingsStore((state) => state.settings);
  const hasHydrated = useReaderSettingsStore((state) => state.hasHydrated);
  const updateSettings = useReaderSettingsStore(
    (state) => state.updateSettings,
  );
  const resetSettings = useReaderSettingsStore((state) => state.resetSettings);

  return { settings, updateSettings, resetSettings, isLoading: !hasHydrated };
};
