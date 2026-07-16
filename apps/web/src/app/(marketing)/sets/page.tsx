import type { Metadata } from 'next';
import { listSets } from '@/lib/services/catalog';
import { SetsExplorer } from './sets-explorer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Set explorer',
  description: 'Browse Pokémon TCG sets, track completion, and value complete sets.',
};

export default async function SetsPage() {
  const sets = await listSets();
  return (
    <div className="mx-auto max-w-5xl py-6">
      <SetsExplorer sets={sets} />
    </div>
  );
}
