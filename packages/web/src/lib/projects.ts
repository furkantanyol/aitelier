import { getAuthUser } from '@/lib/supabase/server';

export type Project = { id: string; name: string; base_model: string };

export async function getUserProjects(): Promise<Project[]> {
  const { supabase } = await getAuthUser();

  const { data } = await supabase
    .from('projects')
    .select('id, name, base_model')
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getProjectName(projectId: string): Promise<string | null> {
  const { supabase } = await getAuthUser();

  const { data } = await supabase.from('projects').select('name').eq('id', projectId).single();

  return data?.name ?? null;
}
