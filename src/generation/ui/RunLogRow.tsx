import { Disclosure, Icon, IconButton } from '../../ui-kit';
import type { RunLogRecord, RunOutcome } from '../runLogStore';
import { useObjectUrl } from './useObjectUrl';

interface RunLogRowProps {
  record: RunLogRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}

const OUTCOME_LABEL: Record<RunOutcome, string> = { running: 'Running', done: 'Done', failed: 'Failed', cancelled: 'Cancelled' };

const pad = (value: number): string => String(value).padStart(2, '0');

function formatClock(startedAt: number): string {
  const time = new Date(startedAt);
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
}

// R24: the opened body of a row. Its own component so the picture addresses exist only while the row is open.
function RunLogBody({ record }: { record: RunLogRecord }): React.JSX.Element {
  const atlasUrl = useObjectUrl(record.atlas);
  const imageUrl = useObjectUrl(record.imagePreview);
  return (
    <div className="run-log-row__body">
      {atlasUrl !== null && <figure className="run-log-row__part"><figcaption>Atlas</figcaption><img className="run-log-row__picture" src={atlasUrl} alt="Atlas sent to the model" /></figure>}
      <div className="run-log-row__part"><span className="run-log-row__caption">Prompt</span><p className="run-log-row__text">{record.prompt}</p></div>
      {record.enhancedPrompt !== null && <div className="run-log-row__part"><span className="run-log-row__caption">Enhanced prompt</span><p className="run-log-row__text">{record.enhancedPrompt}</p></div>}
      {imageUrl !== null && <figure className="run-log-row__part"><figcaption>Generated image</figcaption><img className="run-log-row__picture" src={imageUrl} alt="Generated image" /></figure>}
      {record.errorMessage !== null && (
        <div className="run-log-row__error" role="alert">
          <p className="run-log-row__text">{record.errorMessage}</p>
          {record.errorDetails !== null && <pre className="run-log-row__details">{record.errorDetails}</pre>}
        </div>
      )}
    </div>
  );
}

// R24, R26: one run in the Debug tab: time, model and outcome on the heading, the parts when opened, and a delete button that waits while the run is going.
export function RunLogRow({ record, open, onOpenChange, onRemove }: RunLogRowProps): React.JSX.Element {
  const running = record.outcome === 'running';
  return (
    <Disclosure
      title={`${formatClock(record.startedAt)} · ${record.modelLabel} · ${OUTCOME_LABEL[record.outcome]}`}
      open={open}
      onOpenChange={onOpenChange}
      actions={<IconButton label="Delete log row" icon={<Icon name="trash" size={14} />} disabled={running} disabledReason="The run is still going." onClick={onRemove} />}
    >
      <RunLogBody record={record} />
    </Disclosure>
  );
}
