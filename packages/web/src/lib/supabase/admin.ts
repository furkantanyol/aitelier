import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Server-only admin client using the secret key (bypasses RLS).
// Use only in server actions that do their own auth checks.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required');
  }
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey);
}
