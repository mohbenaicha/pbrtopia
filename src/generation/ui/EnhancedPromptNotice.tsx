interface EnhancedPromptNoticeProps {
  onEnhanceAgain: () => void;
}

// R41: under the Prompt field while the next Generate would reuse the enhanced prompt of the last run; Enhance again drops that snapshot.
export function EnhancedPromptNotice({ onEnhanceAgain }: EnhancedPromptNoticeProps): React.JSX.Element {
  return (
    <div className="generate-panel__reuse" role="status">
      <span>Reusing the enhanced prompt from the last run.</span>
      <button type="button" className="generate-panel__reuse-link" onClick={onEnhanceAgain}>Enhance again</button>
    </div>
  );
}
