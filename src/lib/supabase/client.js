import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client dung o CA server component lan client component.
 * App chay public (khong login) nen chi can anon key — bao ve nam o RLS.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Bao loi som + ro rang thay vi de fetch fail voi message kho hieu.
  console.error(
    '[supabase] Thieu NEXT_PUBLIC_SUPABASE_URL hoac NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Chay may: tao file .env.local. Tren Vercel: Settings > Environment Variables.'
  );
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-key', {
  auth: { persistSession: false },
});

export const isConfigured = Boolean(url && anonKey);
