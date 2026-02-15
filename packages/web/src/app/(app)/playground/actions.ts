'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser } from '@/lib/supabase/server';

export type ModelOption = {
  id: string;
  label: string;
  type: 'base' | 'fine-tuned';
};

/**
 * Get available models for playground (base model + completed runs)
 */
export async function getAvailableModels(projectId: string): Promise<{
  models: ModelOption[] | null;
  error?: string;
}> {
  const { supabase } = await getAuthUser();

  // Get project base model
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('base_model')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { models: null, error: 'Project not found' };
  }

  const models: ModelOption[] = [
    {
      id: project.base_model,
      label: `${project.base_model} (base)`,
      type: 'base',
    },
  ];

  // Get completed training runs
  const { data: runs, error: runsError } = await supabase
    .from('training_runs')
    .select('id, model_id, created_at')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .not('model_id', 'is', null)
    .order('created_at', { ascending: false });

  if (runsError) {
    return { models: null, error: runsError.message };
  }

  if (runs && runs.length > 0) {
    runs.forEach((run, index) => {
      models.push({
        id: run.model_id!,
        label: `v${runs.length - index} — ${run.model_id}`,
        type: 'fine-tuned',
      });
    });
  }

  return { models };
}

/**
 * Get project system prompt
 */
export async function getSystemPrompt(projectId: string): Promise<{
  systemPrompt: string | null;
  error?: string;
}> {
  const { supabase } = await getAuthUser();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('system_prompt')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { systemPrompt: null, error: 'Project not found' };
  }

  return { systemPrompt: project.system_prompt ?? null };
}

/**
 * Save playground output as an unrated example
 */
export async function saveAsExample(
  projectId: string,
  input: string,
  output: string,
): Promise<{
  success?: boolean;
  error?: string;
}> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.from('examples').insert({
    project_id: projectId,
    input,
    output,
    rating: null,
    rated_by: null,
    rated_at: null,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/rate');
  revalidatePath('/dashboard');
  return { success: true };
}
