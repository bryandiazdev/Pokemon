import {
  Home,
  ScanLine,
  Layers,
  BookOpen,
  TrendingUp,
  Eye,
  Bell,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (max 5). */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Home', icon: Home, mobile: true },
  { href: '/app/scan', label: 'Scan', icon: ScanLine, mobile: true },
  { href: '/app/collection', label: 'Collection', icon: Layers, mobile: true },
  { href: '/app/sets', label: 'Sets', icon: BookOpen },
  { href: '/app/market', label: 'Market', icon: TrendingUp, mobile: true },
  { href: '/app/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/app/alerts', label: 'Alerts', icon: Bell },
  { href: '/app/account', label: 'Account', icon: UserCircle, mobile: true },
];
