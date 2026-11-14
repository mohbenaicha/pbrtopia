import { useState } from 'react';
import { Button, Dialog, Icon, IconButton, Tooltip } from '@shared/ui-kit';
import type { CostHint } from '@mat/generation';

const describeRow = (row: CostHint['rows'][number]): string =>
  [row.model, row.canvas, row.layout, row.tilePx === null ? '' : `tile ${row.tilePx} px`].filter((part) => part !== '').join(' · ');

/**
 * Generation R62-R64: one icon beside Generate. Hovering it shows the one-line plan summary and the notices (tiles scaled up, JPEG output); clicking opens an overlay with
 * one block per image: its name and cost, and under it its model, canvas, layout and tile size.
 */
export function PlanSummary({ hint }: { hint: CostHint }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const tooltip = [hint.summary, ...hint.notices].join('\n');
  return (
    <>
      <IconButton label="Plan summary" hint={tooltip} icon={<Icon name="summary" />} expanded={open} onClick={() => setOpen(true)} />
      <Dialog open={open} title="Plan summary" onClose={() => setOpen(false)} actions={<Button onClick={() => setOpen(false)}>Close</Button>}>
        <p className="plan-summary__total">{hint.summary}</p>
        <ul className="plan-summary__rows">
          {hint.rows.map((row) => (
            <li key={row.label} className="plan-summary__row">
              <Tooltip heading={row.label} text="One image the plan will generate; its cost is shown beside it."><span className="plan-summary__name">{row.label}</span></Tooltip>
              <span className="plan-summary__cost">{row.costText}</span>
              <span className="plan-summary__detail">{describeRow(row)}</span>
            </li>
          ))}
        </ul>
        {hint.notices.map((notice) => (
          <p key={notice} className="material-panel__hint">{notice}</p>
        ))}
      </Dialog>
    </>
  );
}
