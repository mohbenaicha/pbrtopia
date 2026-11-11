import { ReferenceStrip } from '@shared/generation';
import type { GenerationPanel } from '@mat/generation';

/** Generation R39: the user's reference images, sent with Image 1 only. The limit of Image 1's model is reported as the plan's problem (inspectPlan), under Generate. */
export function ReferenceImagesSection({ generation, canWrite }: { generation: GenerationPanel; canWrite: boolean }): React.JSX.Element {
  const { references } = generation;
  return (
    <fieldset className="reference-images" disabled={!canWrite}>
      <ReferenceStrip references={references.references} notice={references.notice} onFiles={references.addFiles} onRemove={references.remove} />
    </fieldset>
  );
}
