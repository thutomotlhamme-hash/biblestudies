import type { Metadata } from 'next';
import { EditorialDesk } from '@/components/EditorialDesk';

export const metadata: Metadata = { title: 'Editorial desk — The Holy Bible', robots: { index: false } };

export default function Editorial() {
  return <EditorialDesk />;
}
