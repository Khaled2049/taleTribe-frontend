import React from "react";
import { READER_THEMES } from "../../constants/readerThemes";
import { useReaderSettings } from "../../hooks/useReaderSettings";

const PARAGRAPHS = [5, 4, 6, 3, 5, 4];

interface ReaderSkeletonProps {
  title?: string;
}

export const ReaderSkeleton: React.FC<ReaderSkeletonProps> = ({ title }) => {
  const { settings } = useReaderSettings();
  const theme = READER_THEMES[settings.theme];
  const line = "h-4 rounded bg-current opacity-10 animate-pulse";

  return (
    <div
      className={`min-h-screen ${theme.bg} ${theme.text}`}
      role="status"
      aria-label="Loading chapter"
    >
      <div
        className={`fixed top-0 left-0 w-full z-50 h-[69px] sm:h-[73px] ${theme.bg} border-b ${theme.border} shadow-sm`}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="py-8">
          {title ? (
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 text-center">
              {title}
            </h1>
          ) : (
            <div className="h-9 w-1/2 mx-auto mb-8 rounded bg-current opacity-10 animate-pulse" />
          )}
          <div className="space-y-6" aria-hidden="true">
            {PARAGRAPHS.map((lines, paragraph) => (
              <div key={paragraph} className="space-y-3">
                {Array.from({ length: lines }, (_, index) => (
                  <div
                    key={index}
                    className={`${line} ${index === lines - 1 ? "w-2/3" : "w-full"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
