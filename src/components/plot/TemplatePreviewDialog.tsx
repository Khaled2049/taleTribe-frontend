import { useState } from "react";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import { PLOT_TEMPLATES } from "./plotTemplates";
import {
  rowsForTemplate,
  selectedTemplateEvents,
  type PreviewRow,
} from "./templatePreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Destination =
  { kind: "new"; name: string } | { kind: "existing"; lineId: string };

interface Props {
  open: boolean;
  lines: PlotLine[];
  onClose: () => void;
  onCreate: (
    destination: Destination,
    events: Omit<PlotEvent, "id" | "revision">[],
  ) => Promise<void>;
}

const field =
  "w-full rounded-ns border border-ns-border bg-ns-surface px-2 py-1.5 font-ui text-sm text-ns-ink";

export function TemplatePreviewDialog({
  open,
  lines,
  onClose,
  onCreate,
}: Props) {
  const [templateId, setTemplateId] = useState(PLOT_TEMPLATES[0].id);
  const [rows, setRows] = useState<PreviewRow[]>(() =>
    rowsForTemplate(PLOT_TEMPLATES[0]),
  );
  const [destination, setDestination] = useState<"new" | "existing">("new");
  const [name, setName] = useState(PLOT_TEMPLATES[0].name);
  const [lineId, setLineId] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = PLOT_TEMPLATES.find((template) => template.id === templateId)!;
  const selected = rows.filter((row) => row.included);

  const choose = (id: number) => {
    const template = PLOT_TEMPLATES.find((item) => item.id === id)!;
    setTemplateId(id);
    setRows(rowsForTemplate(template));
    setName(template.name);
  };
  const update = (key: string, patch: Partial<PreviewRow>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  const move = (index: number, offset: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + offset, 0, row);
      return next;
    });
  const create = async () => {
    if (
      busy ||
      selected.length === 0 ||
      selected.some((row) => !row.name.trim())
    )
      return;
    const target: Destination =
      destination === "new"
        ? { kind: "new", name: name.trim() }
        : { kind: "existing", lineId };
    if (target.kind === "new" ? !target.name : !target.lineId) return;
    setBusy(true);
    try {
      await onCreate(target, selectedTemplateEvents(rows));
      onClose();
    } catch {
      // The parent reports the request error; keep the preview open for edits.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-ns-elevated border-ns-border">
        <DialogHeader>
          <DialogTitle className="font-heading italic text-xl text-ns-ink">
            Preview a plot template
          </DialogTitle>
          <DialogDescription>
            Choose, edit and order events before creating them.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
          <nav aria-label="Templates" className="space-y-1">
            {PLOT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => choose(template.id)}
                aria-current={template.id === templateId ? "true" : undefined}
                className={`block w-full rounded-ns px-3 py-2 text-left font-ui text-sm ${template.id === templateId ? "bg-ns-accent-subtle text-ns-ink" : "text-ns-ink-secondary hover:bg-ns-surface-hover"}`}
              >
                {template.name}
              </button>
            ))}
          </nav>
          <div className="space-y-4 min-w-0">
            <div className="font-heading italic text-lg text-ns-ink">
              {chosen.name}
            </div>
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="rounded-ns border border-ns-border p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Include ${row.name}`}
                      checked={row.included}
                      onChange={(event) =>
                        update(row.key, { included: event.target.checked })
                      }
                    />
                    <span className="text-xs text-ns-ink-secondary">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="ml-auto text-xs text-ns-accent disabled:opacity-40"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                      className="text-xs text-ns-accent disabled:opacity-40"
                    >
                      Move down
                    </button>
                  </div>
                  <input
                    aria-label={`Event ${index + 1} name`}
                    className={field}
                    value={row.name}
                    onChange={(event) =>
                      update(row.key, { name: event.target.value })
                    }
                  />
                  <textarea
                    aria-label={`Event ${index + 1} description`}
                    className={field}
                    rows={2}
                    value={row.content}
                    onChange={(event) =>
                      update(row.key, { content: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
            <fieldset className="space-y-2 text-sm text-ns-ink">
              <legend className="font-medium">Destination</legend>
              <label className="flex gap-2">
                <input
                  type="radio"
                  checked={destination === "new"}
                  onChange={() => setDestination("new")}
                />{" "}
                New plot line
              </label>
              {destination === "new" && (
                <input
                  aria-label="New plot line name"
                  className={field}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
              <label className="flex gap-2">
                <input
                  type="radio"
                  checked={destination === "existing"}
                  onChange={() => setDestination("existing")}
                  disabled={!lines.length}
                />{" "}
                Add to existing plot line
              </label>
              {destination === "existing" && (
                <select
                  aria-label="Existing plot line"
                  className={field}
                  value={lineId}
                  onChange={(event) => setLineId(event.target.value)}
                >
                  <option value="">Choose a plot line</option>
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.name}
                    </option>
                  ))}
                </select>
              )}
            </fieldset>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm text-ns-ink-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={
              busy ||
              selected.length === 0 ||
              selected.some((row) => !row.name.trim()) ||
              (destination === "new" ? !name.trim() : !lineId)
            }
            className="rounded-ns bg-ns-accent px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Creating…" : `Create ${selected.length} events`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
