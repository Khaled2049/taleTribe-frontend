import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { withSelectionParam } from "@/lib/selectionParam";

export function useSelectionParam(key: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get(key);
  const select = useCallback(
    (id: string | null) => {
      setSearchParams((previous) => withSelectionParam(previous, key, id), {
        replace: true,
      });
    },
    [key, setSearchParams],
  );
  return [selectedId, select] as const;
}
