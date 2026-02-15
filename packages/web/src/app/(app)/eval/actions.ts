'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ModelOption = {
  id: string;
  label: string;
  type: 'baseline' | 'fine-tuned';
  model_id: string;
};

export type EvalSetupData = {
  modelOptions: ModelOption[];
  valExampleCount: number;
  baseModel: string;
  systemPrompt: string | null;
};

/**
 * Get data for eval setup page
 */
export async function getEvalSetupData(projectId: string): Promise<{
  data: EvalSetupData | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  // Get project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('base_model, system_prompt')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { data: null, error: 'Project not found' };
  }

  // Count validation examples
  const { count: valCount, error: valError } = await supabase
    .from('examples')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('split', 'val');

  if (valError) {
    return { data: null, error: valError.message };
  }

  // Get completed training runs
  const { data: runs, error: runsError } = await supabase
    .from('training_runs')
    .select('id, model_id, created_at')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .not('model_id', 'is', null)
    .order('created_at', { ascending: false });

  if (runsError) {
    return { data: null, error: runsError.message };
  }

  // Build model options
  const modelOptions: ModelOption[] = [
    {
      id: 'baseline',
      label: `Baseline (${project.base_model})`,
      type: 'baseline',
      model_id: project.base_model,
    },
  ];

  // Add completed runs
  if (runs) {
    runs.forEach((run, index) => {
      const version = runs.length - index;
      modelOptions.push({
        id: run.id,
        label: `Version ${version} (${run.model_id?.substring(0, 20)}...)`,
        type: 'fine-tuned',
        model_id: run.model_id!,
      });
    });
  }

  return {
    data: {
      modelOptions,
      valExampleCount: valCount ?? 0,
      baseModel: project.base_model,
      systemPrompt: project.system_prompt,
    },
  };
}

/**
 * Generate outputs for both models on validation set
 */
export async function startEvaluation(
  projectId: string,
  modelAId: string,
  modelBId: string,
): Promise<{
  success: boolean;
  evaluationId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get project details and provider config
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('base_model, system_prompt, provider_config')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { success: false, error: 'Project not found' };
  }

  const providerConfig = project.provider_config as { api_key?: string };
  const apiKey = providerConfig?.api_key;

  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  // Get validation examples
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('id, input')
    .eq('project_id', projectId)
    .eq('split', 'val');

  if (examplesError || !examples || examples.length === 0) {
    return { success: false, error: 'No validation examples found' };
  }

  // Get model options to resolve model IDs
  const { data: setupData } = await getEvalSetupData(projectId);
  if (!setupData) {
    return { success: false, error: 'Failed to get model data' };
  }

  const modelA = setupData.modelOptions.find((m) => m.id === modelAId);
  const modelB = setupData.modelOptions.find((m) => m.id === modelBId);

  if (!modelA || !modelB) {
    return { success: false, error: 'Invalid model selection' };
  }

  // Determine which is the training run (if any)
  const trainingRunId = modelA.type === 'fine-tuned' ? modelAId : modelBId;

  // Generate outputs for all validation examples
  const evaluationRecords = [];

  for (const example of examples) {
    const messages = [];
    if (project.system_prompt) {
      messages.push({
        role: 'system' as const,
        content: project.system_prompt,
      });
    }
    messages.push({
      role: 'user' as const,
      content: example.input,
    });

    try {
      // Generate model A output
      const modelAOutput = await generateCompletion(modelA.model_id, messages, apiKey);

      // Generate model B output
      const modelBOutput = await generateCompletion(modelB.model_id, messages, apiKey);

      evaluationRecords.push({
        project_id: projectId,
        training_run_id: trainingRunId,
        example_id: example.id,
        model_output: modelA.type === 'fine-tuned' ? modelAOutput : modelBOutput,
        baseline_output: modelA.type === 'baseline' ? modelAOutput : modelBOutput,
      });
    } catch (error) {
      console.error(`Failed to generate outputs for example ${example.id}:`, error);
      return {
        success: false,
        error: `Failed to generate outputs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Insert evaluation records
  const { data: insertedEvals, error: insertError } = await supabase
    .from('evaluations')
    .insert(evaluationRecords)
    .select('training_run_id')
    .limit(1)
    .single();

  if (insertError || !insertedEvals) {
    return { success: false, error: 'Failed to save evaluation records' };
  }

  revalidatePath(`/eval`);

  return {
    success: true,
    evaluationId: insertedEvals.training_run_id,
  };
}

/**
 * Generate completion using Together.ai API
 */
async function generateCompletion(
  modelId: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  apiKey: string,
): Promise<string> {
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: 512,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together.ai API error: ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? '';
}
