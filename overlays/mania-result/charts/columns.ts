import type { Columns, JudgementV1, JudgementV2 } from 'mania-judge';
import { columnStats, type ColumnStat, type JudgeMode } from '../accuracy';

const ROWS: { label: string; format: (stat: ColumnStat) => string }[] = [
  { label: 'Accuracy', format: formatAccuracy },
  { label: 'Avg offset', format: formatOffset },
  { label: 'UR', format: formatUnstableRate },
];

function formatAccuracy(stat: ColumnStat) {
  return stat.count > 0 ? `${(stat.accuracy * 100).toFixed(2)}%` : '—';
}

function formatOffset({ meanOffset }: ColumnStat) {
  if (meanOffset === null) return '—';

  const rounded = Math.round(meanOffset * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}ms`;
}

function formatUnstableRate({ unstableRate }: ColumnStat) {
  return unstableRate === null ? '—' : unstableRate.toFixed(2);
}

/** Render one table row per metric and one table column per key. */
export function update(
  judgements: Columns<JudgementV1> | Columns<JudgementV2>,
  mode: JudgeMode,
) {
  const container = document.getElementById('columns');
  if (!container) return;

  const columns = columnStats(judgements, mode);

  container.replaceChildren(buildTable(columns));
}

function buildTable(columns: ColumnStat[]) {
  const tbody = document.createElement('tbody');

  for (const row of ROWS) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = row.label;
    tr.append(th);

    for (const column of columns) {
      const td = document.createElement('td');
      td.textContent = row.format(column);
      tr.append(td);
    }

    tbody.append(tr);
  }

  const table = document.createElement('table');
  table.append(tbody);
  return table;
}
