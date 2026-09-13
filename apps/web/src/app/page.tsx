import { redirect } from 'next/navigation';

/** The product opens on the free feed, exactly like the mobile app. */
export default function HomePage(): never {
  redirect('/free');
}
