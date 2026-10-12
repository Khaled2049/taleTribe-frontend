import { useReaderEnvironment } from "../../../runtime.js";

export const useReaderSettings = () => useReaderEnvironment().preferences;
