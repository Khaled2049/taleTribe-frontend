import { CircleCheck, Target } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GOAL_PRESETS, dayKey, wordsToday } from "@/lib/writingGoal";
import { useWritingGoalStore } from "@/stores/writingGoalStore";

/** Daily word goal: shows progress and lets the writer set or clear the target. */
export function WritingGoal() {
  const goal = useWritingGoalStore((state) => state.goal);
  const written = useWritingGoalStore((state) =>
    wordsToday(state, dayKey(new Date())),
  );
  const setGoal = useWritingGoalStore((state) => state.setGoal);
  const resetToday = useWritingGoalStore((state) => state.resetToday);
  const reached = goal !== null && written >= goal;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Daily word goal"
        aria-label="Daily word goal"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-ns px-1.5 py-1 font-ui text-xs tabular-nums transition-colors hover:bg-ns-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)] ${
          reached ? "text-ns-accent" : "text-ns-ink-muted hover:text-ns-ink"
        }`}
      >
        {reached ? (
          <CircleCheck className="h-3.5 w-3.5" />
        ) : (
          <Target className="h-3.5 w-3.5" />
        )}
        {goal === null
          ? "Set goal"
          : `${written.toLocaleString()} / ${goal.toLocaleString()} today`}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="w-48">
        <DropdownMenuLabel className="font-ui text-xs font-medium text-ns-ink-secondary">
          Words per day
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={goal === null ? "none" : String(goal)}
          onValueChange={(value) =>
            setGoal(value === "none" ? null : Number(value))
          }
        >
          {GOAL_PRESETS.map((preset) => (
            <DropdownMenuRadioItem
              key={preset}
              value={String(preset)}
              className="tabular-nums"
            >
              {preset.toLocaleString()}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem value="none">No goal</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {goal !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={resetToday}>
              Reset today's count
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
