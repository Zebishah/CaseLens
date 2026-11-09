import './AuthActionSpinner.css';
import { IntelligenceMark } from './landing/LandingIcons';

export function AuthActionSpinner({ label = 'Processing' }: { label?: string }) {
  return <span className="case-auth-button-spinner" role="status" aria-label={label}>
    <span className="case-auth-button-spinner__orbit" aria-hidden="true" />
    <IntelligenceMark className="case-auth-button-spinner__mark" />
  </span>;
}
