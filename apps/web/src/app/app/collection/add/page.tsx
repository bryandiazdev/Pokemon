import { AddForm } from './add-form';

export const metadata = { title: 'Add a card' };

export default function AddCardPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a card</h1>
        <p className="text-muted">Search the catalog, then record condition, quantity, and cost.</p>
      </div>
      <AddForm />
    </div>
  );
}
