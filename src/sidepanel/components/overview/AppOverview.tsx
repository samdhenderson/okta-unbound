/**
 * @module sidepanel/components/overview/AppOverview
 * @description Overview branch for a detected Okta app page.
 *
 * A deliberately small starting point: it surfaces the detected app's identity and
 * offers the app-scoped exports (assigned users, assigned groups) as pre-scoped
 * deep-links, replacing the generic "waiting for context" dead-end an app page used
 * to hit. Intended to grow into a richer app-insight view (assignment counts,
 * provisioning status, …) later, so it keeps its own component seam now.
 */
import React from 'react';
import { Button } from '../shared';

/** Props for {@link AppOverview}. */
interface AppOverviewProps {
  /** Detected Okta app id. */
  appId: string;
  /** Detected Okta app display name. */
  appName: string;
  /**
   * Open the Export tab pre-scoped to an app-scoped descriptor for this app.
   * @param descriptorId - `'app-users'` or `'app-groups'`.
   */
  onExport: (descriptorId: string, appId: string, appName: string) => void;
}

/**
 * Minimal Overview for a detected app: identity + the app-scoped export deep-links.
 * A foundation to iterate into a fuller app view, not a finished feature.
 */
const AppOverview: React.FC<AppOverviewProps> = ({ appId, appName, onExport }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">{appName}</h2>
      <p className="mt-0.5 text-sm text-neutral-600">
        Detected app. Export its assignments below — more app insights are coming here.
      </p>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon="download"
        onClick={() => onExport('app-users', appId, appName)}
        title="Export the users assigned to this app (opens the Export tab pre-scoped)"
      >
        Export App Users
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="download"
        onClick={() => onExport('app-groups', appId, appName)}
        title="Export the groups assigned to this app (opens the Export tab pre-scoped)"
      >
        Export App Groups
      </Button>
    </div>
  </div>
);

export default AppOverview;
