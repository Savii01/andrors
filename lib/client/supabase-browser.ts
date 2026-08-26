import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xthievnrixxudbqimrpu.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aGlldm5yaXh4dWRicWltcnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODI0NzMsImV4cCI6MjEwMzI1ODQ3M30.3S7fsj4SwEsavPBmHy-onprorH8_i0Iq6wuI6AuILns';

    client = createClient(url, key, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
      },
    });
  }
  return client;
}
