import React from "react";

interface PieProps {
  correct: number;
  incorrect: number;
  skipped: number;
}

/**
 * A pie chart component to display students performance distribution.
 * Accepts props for correct, incorrect and skipped questions.
 * The component renders a pie chart with three sections in different colors,
 * each representing the percentage of correct, incorrect and skipped questions.
 * The component also renders a legend below the pie chart with text
 * labels for each section.
 * @param {PieProps} props - Props for correct, incorrect and skipped questions.
 * @returns {React.ReactElement} - A pie chart component displaying quiz performance distribution.
 */
export default function PieChart({ correct, incorrect, skipped }: PieProps) {
  const total = correct + incorrect + skipped;

  const correctPct = (correct / total) * 100;
  const incorrectPct = (incorrect / total) * 100;
  const skippedPct = (skipped / total) * 100;

  const gradient = `
    conic-gradient(
      #4ade80 0% ${correctPct}%,
      #f87171 ${correctPct}% ${correctPct + incorrectPct}%,
      #facc15 ${correctPct + incorrectPct}% 100%
    )
  `;

  return (
    <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-white mb-4 text-center">
        Quiz Performance Distribution
      </h2>

      <div
        className="w-48 h-48 rounded-full mx-auto shadow-inner"
        style={{ background: gradient }}
      />

      <div className="mt-6 text-white text-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#4ade80]" />
          <p>Correct: {correct}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#f87171]" />
          <p>Incorrect: {incorrect}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#facc15]" />
          <p>Skipped: {skipped}</p>
        </div>
      </div>
    </div>
  );
}
