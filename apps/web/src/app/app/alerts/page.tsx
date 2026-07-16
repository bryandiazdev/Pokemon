import { AlertsClient } from './alerts-client';

export const metadata = { title: 'Alerts' };

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Price alerts</h1>
        <p className="text-muted">Get notified when a card crosses your target.</p>
      </div>
      <AlertsClient />
    </div>
  );
}
