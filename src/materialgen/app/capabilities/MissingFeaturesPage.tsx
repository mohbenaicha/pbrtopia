import type { CapabilityCheck } from './detectCapabilities';
import './MissingFeaturesPage.css';

/** The one full-page message when the browser lacks something the app needs (materialgen R6a). Nothing else is drawn. */
export function MissingFeaturesPage({ missing }: { missing: CapabilityCheck[] }): React.JSX.Element {
  return (
    <main className="missing-features" role="alert" data-testid="missing-features">
      <h1 className="missing-features__title">This browser cannot run the app</h1>
      <p className="missing-features__lead">The following features are missing:</p>
      <ul className="missing-features__list">
        {missing.map((check) => (
          <li key={check.id}>{check.message}</li>
        ))}
      </ul>
      <p className="missing-features__hint">Try a current version of Chrome, Edge or Firefox on a computer with a graphics card.</p>
    </main>
  );
}
