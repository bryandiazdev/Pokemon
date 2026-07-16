import { redirect } from 'next/navigation';

/** App-shell nav points here; the set explorer lives on the public /sets route. */
export default function AppSetsRedirect() {
  redirect('/sets');
}
