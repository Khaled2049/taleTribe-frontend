import { useState } from "react";
import { Loader, Lightbulb } from "lucide-react";
import { brainstormIdeas, BrainstormIdeasRequest } from "@/cloudFunctions/ai";

interface BrainstormIdeasProps {
  storyId: string | null;
}

export function BrainstormIdeas({ storyId }: BrainstormIdeasProps) {
  const [brainstormType, setBrainstormType] = useState<
    "characters" | "plots" | "places" | "themes"
  >("characters");
  const [brainstormLoading, setBrainstormLoading] = useState(false);
  const [brainstormResults, setBrainstormResults] = useState<string[]>([]);
  const [brainstormError, setBrainstormError] = useState<string>("");

  const handleBrainstormIdeas = async () => {
    if (!storyId) {
      setBrainstormError("No story selected");
      return;
    }

    setBrainstormLoading(true);
    setBrainstormError("");
    setBrainstormResults([]);

    try {
      const request: BrainstormIdeasRequest = {
        storyId,
        type: brainstormType,
        count: 5,
      };

      const response = await brainstormIdeas(request);

      setBrainstormResults(response.data.ideas.map((idea) => idea.text));
    } catch (error) {
      console.error("Error generating brainstorm ideas:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate ideas";

      setBrainstormError(errorMessage);
    } finally {
      setBrainstormLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-dark-green dark:text-light-green" />
        <h4 className="text-base font-semibold text-black dark:text-white">
          Brainstorm Ideas
        </h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-2">
            Type
          </label>
          <select
            value={brainstormType}
            onChange={(e) =>
              setBrainstormType(
                e.target.value as "characters" | "plots" | "places" | "themes",
              )
            }
            className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green"
            disabled={brainstormLoading}
          >
            <option value="characters">Characters</option>
            <option value="plots">Plots</option>
            <option value="places">Places</option>
            <option value="themes">Themes</option>
          </select>
        </div>

        <button
          onClick={handleBrainstormIdeas}
          disabled={brainstormLoading || !storyId}
          className="w-full px-4 py-2 bg-dark-green dark:bg-light-green text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 text-sm font-medium"
        >
          {brainstormLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightbulb className="w-4 h-4" />
              Generate Ideas
            </>
          )}
        </button>

        {brainstormError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-xs text-red-600 dark:text-red-400">
              {brainstormError}
            </p>
          </div>
        )}

        {brainstormResults.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-black/70 dark:text-white/70 mb-2">
              Generated Ideas:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {brainstormResults.map((idea, index) => (
                <div
                  key={index}
                  className="p-3 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md text-xs text-black dark:text-white"
                >
                  {idea}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
