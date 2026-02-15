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

export type EvaluationItem = {
  id: string;
  example_id: string;
  input: string;
  output_a: string;
  output_b: string;
  is_a_model: boolean; // true if A is model, false if A is baseline
  preferred: 'model' | 'baseline' | 'tie' | null;
  model_score: number | null;
  baseline_score: number | null;
};

/**
 * Get all evaluation items for a training run
 */
export async function getEvaluationItems(trainingRunId: string): Promise<{
  data: EvaluationItem[] | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  // Get all evaluation records with example inputs
  const { data: evals, error: evalsError } = await supabase
    .from('evaluations')
    .select('id, example_id, model_output, baseline_output, preferred, model_score, baseline_score')
    .eq('training_run_id', trainingRunId)
    .order('created_at', { ascending: true });

  if (evalsError || !evals) {
    return { data: null, error: 'Failed to load evaluation items' };
  }

  // Get example inputs
  const exampleIds = evals.map((e) => e.example_id);
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('id, input')
    .in('id', exampleIds);

  if (examplesError || !examples) {
    return { data: null, error: 'Failed to load example inputs' };
  }

  // Build a map for quick lookup
  const exampleMap = new Map(examples.map((e) => [e.id, e.input]));

  // Create evaluation items with random A/B assignment
  const items: EvaluationItem[] = evals.map((evalRecord) => {
    const input = exampleMap.get(evalRecord.example_id) ?? '';

    // Use evaluation ID to deterministically randomize A/B assignment
    // This ensures the same example always gets the same assignment across page refreshes
    const isAModel = evalRecord.id.charCodeAt(0) % 2 === 0;

    // Cast preferred to proper type (Supabase returns string | null)
    const preferred = evalRecord.preferred as 'model' | 'baseline' | 'tie' | null;

    return {
      id: evalRecord.id,
      example_id: evalRecord.example_id,
      input,
      output_a: isAModel ? (evalRecord.model_output ?? '') : (evalRecord.baseline_output ?? ''),
      output_b: isAModel ? (evalRecord.baseline_output ?? '') : (evalRecord.model_output ?? ''),
      is_a_model: isAModel,
      preferred,
      model_score: evalRecord.model_score,
      baseline_score: evalRecord.baseline_score,
    };
  });

  return { data: items };
}

/**
 * Save evaluation scores for a single item
 */
export async function saveEvaluationScore(
  evaluationId: string,
  isAModel: boolean,
  preferred: 'a' | 'b' | 'tie',
  scoreA?: number,
  scoreB?: number,
): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Convert A/B preference to model/baseline preference
  let modelPreferred: 'model' | 'baseline' | 'tie';
  if (preferred === 'tie') {
    modelPreferred = 'tie';
  } else if (preferred === 'a') {
    modelPreferred = isAModel ? 'model' : 'baseline';
  } else {
    modelPreferred = isAModel ? 'baseline' : 'model';
  }

  // Convert A/B scores to model/baseline scores
  const modelScore = isAModel ? scoreA : scoreB;
  const baselineScore = isAModel ? scoreB : scoreA;

  // Build update object conditionally to handle optional scores
  const updateData: {
    preferred: 'model' | 'baseline' | 'tie';
    scored_by: string;
    model_score?: number;
    baseline_score?: number;
  } = {
    preferred: modelPreferred,
    scored_by: user.id,
  };

  if (modelScore !== undefined) {
    updateData.model_score = modelScore;
  }
  if (baselineScore !== undefined) {
    updateData.baseline_score = baselineScore;
  }

  const { error } = await supabase.from('evaluations').update(updateData).eq('id', evaluationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
