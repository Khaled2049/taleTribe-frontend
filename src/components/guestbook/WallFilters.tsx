import React from "react";
import { WallFilter } from "@/hooks/queries/useGuestbookQueries";

interface WallFiltersProps {
    filter: WallFilter;
    onChange: (filter: WallFilter) => void;
}

const FILTERS: { value: WallFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "following", label: "People I follow" },
    { value: "mine", label: "Just me" },
];

/**
 * A filter change swaps the query key (see useWallFeed) rather than
 * refiltering an already-loaded page — every filter still resolves to
 * `created_at DESC` server-side, so this never reorders or ranks anything.
 */
const WallFilters: React.FC<WallFiltersProps> = ({ filter, onChange }) => {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => {
                const active = f.value === filter;
                return (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => onChange(f.value)}
                        className={`font-ui text-[13px] font-semibold px-[14px] py-[7px] rounded-full border transition-colors ${active
                                ? "bg-ns-accent border-ns-accent text-white"
                                : "bg-ns-bg border-ns-border text-ns-ink-secondary hover:border-ns-border-strong"
                            }`}
                    >
                        {f.label}
                    </button>
                );
            })}
            {/* Wrapped onto its own line the caption would otherwise sit flush right
          under the pills, reading as a stray fragment rather than a note. */}
            <span className="w-full sm:w-auto sm:ml-auto font-ui text-[12.5px] text-ns-ink-muted">
                Newest first
            </span>
        </div>
    );
};

export default WallFilters;
