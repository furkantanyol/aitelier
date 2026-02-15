import { getAuthUser } from '@/lib/supabase/server';

export type Project = { id: string; name: string };

export async function getUserProjects(): Promise<Project[]> {
  const { supabase } = await getAuthUser();

  const { data } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false });

  return data ?? [];
}
