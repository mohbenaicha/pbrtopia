import './ReadOnlyBanner.css';

const READ_ONLY_MESSAGE = 'This project is open in another tab, so changes are not saved here.';

// Shown while another tab holds the project's lock.
export function ReadOnlyBanner(): React.JSX.Element {
  return (
    <p className="read-only-banner" role="status">
      {READ_ONLY_MESSAGE}
    </p>
  );
}
