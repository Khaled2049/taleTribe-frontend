import React from "react";

interface StorySynopsisProps {
  description?: string;
}

export const StorySynopsis: React.FC<StorySynopsisProps> = ({
  description,
}) => {
  return (
    <section className="mb-10">
      <p className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest mb-4">
        Synopsis
      </p>
      <p className="font-body text-base text-ns-ink-secondary leading-relaxed">
        {description || "No description available."}
      </p>
    </section>
  );
};
