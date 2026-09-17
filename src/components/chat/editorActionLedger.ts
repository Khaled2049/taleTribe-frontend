import type { EditorApplyResult } from "@novelsync/assistant-contracts";

export type EditorActionResolution = {
  decision: "applied" | "rejected" | "revision_requested" | "apply_failed";
  result?: EditorApplyResult;
  feedback?: string;
};

export type EditorActionState =
  | { status: "idle" }
  | { status: "applying" }
  | ({ status: "resolved" } & EditorActionResolution);

export class EditorActionLedger {
  private readonly actions = new Map<string, EditorActionState>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private emit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  get(approvalId: string): EditorActionState {
    return this.actions.get(approvalId) ?? { status: "idle" };
  }

  beginApply(approvalId: string): boolean {
    if (this.get(approvalId).status !== "idle") return false;
    this.actions.set(approvalId, { status: "applying" });
    this.emit();
    return true;
  }

  resolve(approvalId: string, resolution: EditorActionResolution) {
    this.actions.set(approvalId, { status: "resolved", ...resolution });
    this.emit();
  }

  reset(approvalId: string) {
    this.actions.delete(approvalId);
    this.emit();
  }

  clear() {
    this.actions.clear();
    this.emit();
  }
}
