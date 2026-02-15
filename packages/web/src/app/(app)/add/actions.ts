'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser } from '@/lib/supabase/server';

export async function addExample(
  projectId: string,
  input: string,
  output: string,
  rating?: number,
) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.from('examples').insert({
    project_id: projectId,
    input,
    output,
    rating: rating ?? null,
    rated_by: rating ? user.id : null,
    rated_at: rating ? new Date().toISOString() : null,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/rate');
  return { success: true };
}

type BulkExample = {
  input: string;
  output: string;
  rating?: number;
};

export async function importExamples(projectId: string, examples: BulkExample[]) {
  const { supabase, user } = await getAuthUser();

  const rows = examples.map((ex) => ({
    project_id: projectId,
    input: ex.input,
    output: ex.output,
    rating: ex.rating ?? null,
    rated_by: ex.rating ? user.id : null,
    rated_at: ex.rating ? new Date().toISOString() : null,
    created_by: user.id,
  }));

  const { error } = await supabase.from('examples').insert(rows);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/rate');
  return { success: true, count: rows.length };
}
