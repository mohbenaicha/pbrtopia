import { Disclosure, Icon, IconButton, Tooltip } from '../../ui-kit';
import { DETAIL_LEVELS } from '../normal/detailLevels';
import type { RunLogRecord, RunOutcome } from '../runLogStore';
import { RunLogMaskPart } from './RunLogMaskPart';
import { RunLogPicture } from './RunLogPicture';
import { RunLogPictureGrid } from './RunLogPictureGrid';

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
  // Custom R27: a custom row shows its snapshots and returned images as grids in place of the single atlas and image.
  const snapshots = record.sheets.flatMap((sheet) => (sheet.snapshot === null ? [] : [{ number: sheet.index + 1, label: sheet.label, blob: sheet.snapshot }]));
  const returned = record.sheets.flatMap((sheet) => (sheet.image === null ? [] : [{ number: sheet.index + 1, label: sheet.label, blob: sheet.image }]));
  const { normal } = record; // normal-map R12: the picture sent is the upright sheet, the one returned the height map, then the normal map made; the settings are shown, there is no enhanced prompt
  const levelName = normal === undefined ? '' : (DETAIL_LEVELS.find((level) => level.level === normal.detail)?.name ?? '');
  return (
    <div className="run-log-row__body">
      {normal !== undefined && (
        <p className="run-log-row__text">
          {normal.quality === null ? null : <span>{`${normal.quality.charAt(0).toUpperCase()}${normal.quality.slice(1)} quality`}</span>}
          {normal.quality === null ? null : ' · '}
          <span>{`Detail ${normal.detail}: ${levelName}`}</span>
        </p>
      )}
      {record.masks !== undefined && <RunLogMaskPart masks={record.masks} />}
      {record.atlas !== null && (normal === undefined ? <RunLogPicture blob={record.atlas} label="Atlas" alt="Atlas sent to the model" fileStem="atlas" /> : <RunLogPicture blob={record.atlas} label="Upright sheet sent" alt="Upright sheet sent to the model" fileStem="upright-sheet-sent" />)}
      {snapshots.length > 0 && <RunLogPictureGrid title="Snapshots" fileStem="snapshot" cells={snapshots} />}
      {record.masks === undefined
        ? <div className="run-log-row__part"><Tooltip heading="Prompt" text="The text you wrote for this run."><span className="run-log-row__caption">Prompt</span></Tooltip><p className="run-log-row__text">{record.prompt}</p></div>
        : record.prompt !== '' && <div className="run-log-row__part"><Tooltip heading="Describe the materials" text="The text you wrote for the request that lists the materials."><span className="run-log-row__caption">Describe the materials</span></Tooltip><p className="run-log-row__text">{record.prompt}</p></div>}
      {record.enhancedPrompt !== null && <div className="run-log-row__part"><Tooltip heading="Enhanced prompt" text="Your prompt as the prompt enhancer model rewrote it."><span className="run-log-row__caption">Enhanced prompt</span></Tooltip><p className="run-log-row__text">{record.enhancedPrompt}</p></div>}
      {record.imagePreview !== null && (normal === undefined ? <RunLogPicture blob={record.imagePreview} label="Generated image" alt={record.masks === undefined ? 'Generated image' : 'Image returned by the model'} fileStem="generated" /> : <RunLogPicture blob={record.imagePreview} label="Height map returned" alt="Height map returned" fileStem="height-map" />)}
      {normal?.made != null && <RunLogPicture blob={normal.made} label="Normal map made" alt="Normal map made" fileStem="normal-map" />}
      {returned.length > 0 && <RunLogPictureGrid title="Returned images" fileStem="image" cells={returned} />}
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
      actions={<IconButton label="Delete log row" icon={<Icon name="trash" />} disabled={running} disabledReason="The run is still going." onClick={onRemove} />}
    >
      <RunLogBody record={record} />
    </Disclosure>
  );
}
