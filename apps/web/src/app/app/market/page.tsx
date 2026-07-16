import { redirect } from 'next/navigation';

/** App-shell nav points here; market intelligence lives on the public /market route. */
export default function AppMarketRedirect() {
  redirect('/market');
}
