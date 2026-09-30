import { lazy, type ReactNode } from "react";

const Web3Provider = lazy(() =>
  import("./Web3Provider").then((m) => ({ default: m.Web3Provider })),
);

export function Web3Boundary({ children }: { children: ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
