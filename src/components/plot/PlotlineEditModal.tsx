import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlotLine } from "@/types/IPlot";
import { NO_AUTOFILL } from "@/lib/noAutofill";

interface PlotlineEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingPlotLine: PlotLine | null;
  setEditingPlotLine: (timeline: PlotLine | null) => void;
}

export const PlotLineEditModal: React.FC<PlotlineEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlotLine,
  setEditingPlotLine,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Timeline</DialogTitle>
        </DialogHeader>
        {editingPlotLine && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="plot-line-title"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <Input
                {...NO_AUTOFILL}
                id="plot-line-title"
                value={editingPlotLine.name}
                onChange={(e) =>
                  setEditingPlotLine({
                    ...editingPlotLine,
                    name: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="plot-line-summary"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <Textarea
                {...NO_AUTOFILL}
                id="plot-line-summary"
                value={editingPlotLine.description}
                onChange={(e) =>
                  setEditingPlotLine({
                    ...editingPlotLine,
                    description: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
