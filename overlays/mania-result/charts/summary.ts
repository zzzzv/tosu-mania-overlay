import type { JudgeSummary } from '../accuracy';

/**
 * Render one line per judgement system below the chart, each stating that
 * system's accuracy plus the timing offset that yields the highest accuracy.
 */
export function update(summaries: JudgeSummary[]) {
  const container = document.getElementById('summary');
  if (!container) return;

  container.replaceChildren(
    ...summaries.map((summary) => {
      const line = document.createElement('div');
      line.textContent = formatSummary(summary);
      return line;
    })
  );
}

function formatSummary({ mode, accuracy, bestOffset, bestAccuracy }: JudgeSummary) {
  return `${mode}: ${formatAccuracy(accuracy)} accuracy, peak ${formatAccuracy(bestAccuracy)} at offset ${formatOffset(bestOffset)}`;
}

function formatAccuracy(accuracy: number) {
  return `${(accuracy * 100).toFixed(2)}%`;
}

function formatOffset(offset: number) {
  return `${offset > 0 ? '+' : ''}${offset}ms`;
}
