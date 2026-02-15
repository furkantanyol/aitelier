'use server';

import { getAuthUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type TrainingConfig = {
  epochs: number;
  batch_size: number;
  learning_rate: number;
  lora_r: number;
  lora_alpha: number;
  lora_dropout: number;
};

export type PreflightData = {
  qualityCount: number;
  trainCount: number;
  valCount: number;
  unassignedCount: number;
  qualityThreshold: number;
  baseModel: string;
  trainingConfig: TrainingConfig;
  lastRun: {
    id: string;
    example_count: number;
    train_count: number;
    val_count: number;
    created_at: string;
    config: TrainingConfig;
  } | null;
  warnings: string[];
};

export async function getPreflightData(projectId: string): Promise<{
  data: PreflightData | null;
  error?: string;
}> {
  const { supabase } = await getAuthUser();

  // Get project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('quality_threshold, base_model, training_config')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { data: null, error: 'Project not found' };
  }

  // Get all examples with ratings and splits
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('rating, split')
    .eq('project_id', projectId);

  if (examplesError) {
    return { data: null, error: examplesError.message };
  }

  const threshold = project.quality_threshold ?? 8;

  // Calculate counts
  const qualityCount =
    examples?.filter((e) => e.rating !== null && e.rating >= threshold).length ?? 0;
  const trainCount = examples?.filter((e) => e.split === 'train').length ?? 0;
  const valCount = examples?.filter((e) => e.split === 'val').length ?? 0;
  const unassignedCount = examples?.filter((e) => e.split === null).length ?? 0;

  // Get last training run
  const { data: lastRun } = await supabase
    .from('training_runs')
    .select('id, example_count, train_count, val_count, created_at, config')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Generate warnings
  const warnings: string[] = [];

  if (qualityCount < 20) {
    warnings.push(`Only ${qualityCount} quality examples (recommend 20+)`);
  }

  if (trainCount < 10) {
    warnings.push(`Only ${trainCount} training examples (recommend 10+)`);
  }

  if (valCount < 2) {
    warnings.push(`Only ${valCount} validation examples (recommend 2+)`);
  }

  if (unassignedCount > 0) {
    warnings.push(`${unassignedCount} examples not assigned to train/val split`);
  }

  if (trainCount === 0) {
    warnings.push('No training examples assigned. Run split first.');
  }

  // Parse training config with defaults
  const trainingConfig: TrainingConfig = {
    epochs: 3,
    batch_size: 4,
    learning_rate: 0.00001,
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.05,
    ...(project.training_config as Partial<TrainingConfig>),
  };

  return {
    data: {
      qualityCount,
      trainCount,
      valCount,
      unassignedCount,
      qualityThreshold: threshold,
      baseModel: project.base_model,
      trainingConfig,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            example_count: lastRun.example_count,
            train_count: lastRun.train_count,
            val_count: lastRun.val_count,
            created_at: lastRun.created_at,
            config: lastRun.config as TrainingConfig,
          }
        : null,
      warnings,
    },
  };
}

export async function updateTrainingConfig(
  projectId: string,
  config: TrainingConfig,
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from('projects')
    .update({ training_config: config })
    .eq('id', projectId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/train');
  revalidatePath('/settings');
  return { success: true };
}

export type SplitData = {
  unassigned: Array<{
    id: string;
    input: string;
    output: string;
    rating: number | null;
  }>;
  train: Array<{
    id: string;
    input: string;
    output: string;
    rating: number | null;
  }>;
  val: Array<{
    id: string;
    input: string;
    output: string;
    rating: number | null;
  }>;
  isValLocked: boolean;
  stats: {
    unassignedAvgRating: number | null;
    trainAvgRating: number | null;
    valAvgRating: number | null;
  };
};

export async function getSplitData(projectId: string): Promise<{
  data: SplitData | null;
  error?: string;
}> {
  const { supabase } = await getAuthUser();

  // Get project to check if val is locked
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { data: null, error: 'Project not found' };
  }

  // Get all quality examples (with ratings)
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('id, input, output, rating, split')
    .eq('project_id', projectId)
    .not('rating', 'is', null)
    .order('created_at', { ascending: false });

  if (examplesError) {
    return { data: null, error: examplesError.message };
  }

  const unassigned = examples?.filter((e) => e.split === null) ?? [];
  const train = examples?.filter((e) => e.split === 'train') ?? [];
  const val = examples?.filter((e) => e.split === 'val') ?? [];

  // Calculate average ratings
  const calcAvg = (arr: typeof examples) => {
    const rated = arr.filter((e) => e.rating !== null);
    if (rated.length === 0) return null;
    return rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length;
  };

  // Val is locked if there are already validation examples assigned
  const isValLocked = val.length > 0;

  return {
    data: {
      unassigned,
      train,
      val,
      isValLocked,
      stats: {
        unassignedAvgRating: calcAvg(unassigned),
        trainAvgRating: calcAvg(train),
        valAvgRating: calcAvg(val),
      },
    },
  };
}

export async function autoSplit(
  projectId: string,
  ratio: number = 0.8,
): Promise<{ success: boolean; error?: string; trainCount?: number; valCount?: number }> {
  const { supabase, user } = await getAuthUser();

  // Get project to check if val is locked
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('quality_threshold')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { success: false, error: 'Project not found' };
  }

  // Get all quality examples that are not in val (respect lock)
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('id, rating, split')
    .eq('project_id', projectId)
    .not('rating', 'is', null)
    .gte('rating', project.quality_threshold ?? 8);

  if (examplesError) {
    return { success: false, error: examplesError.message };
  }

  if (!examples || examples.length === 0) {
    return { success: false, error: 'No quality examples to split' };
  }

  // Check if val is locked
  const valExamples = examples.filter((e) => e.split === 'val');
  const isValLocked = valExamples.length > 0;

  // Get examples to split (exclude locked val)
  const toSplit = isValLocked ? examples.filter((e) => e.split !== 'val') : examples;

  // Stratified split by rating
  const ratingGroups: Record<number, typeof examples> = {};
  toSplit.forEach((ex) => {
    const rating = ex.rating ?? 0;
    if (!ratingGroups[rating]) ratingGroups[rating] = [];
    ratingGroups[rating].push(ex);
  });

  const trainIds: string[] = [];
  const valIds: string[] = [];

  // Split each rating group
  Object.values(ratingGroups).forEach((group) => {
    // Shuffle group
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    const trainSize = Math.ceil(shuffled.length * ratio);

    shuffled.forEach((ex, i) => {
      if (i < trainSize) {
        trainIds.push(ex.id);
      } else {
        valIds.push(ex.id);
      }
    });
  });

  // Update train examples
  if (trainIds.length > 0) {
    const { error: trainError } = await supabase
      .from('examples')
      .update({ split: 'train' })
      .in('id', trainIds);

    if (trainError) {
      return { success: false, error: trainError.message };
    }
  }

  // Update new val examples (don't touch locked val)
  if (valIds.length > 0 && !isValLocked) {
    const { error: valError } = await supabase
      .from('examples')
      .update({ split: 'val' })
      .in('id', valIds);

    if (valError) {
      return { success: false, error: valError.message };
    }
  }

  revalidatePath('/train');
  revalidatePath('/dashboard');
  return {
    success: true,
    trainCount: trainIds.length,
    valCount: isValLocked ? valExamples.length : valIds.length,
  };
}

export async function unlockValidationSet(projectId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { supabase, user } = await getAuthUser();

  // Clear all val assignments (set to null)
  const { error } = await supabase
    .from('examples')
    .update({ split: null })
    .eq('project_id', projectId)
    .eq('split', 'val');

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/train');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function moveExamplesToSplit(
  projectId: string,
  exampleIds: string[],
  targetSplit: 'train' | 'val' | null,
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await getAuthUser();

  if (exampleIds.length === 0) {
    return { success: true };
  }

  const { error } = await supabase
    .from('examples')
    .update({ split: targetSplit })
    .eq('project_id', projectId)
    .in('id', exampleIds);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/train');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function startTraining(projectId: string): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
}> {
  const { supabase, user } = await getAuthUser();

  // Get project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('base_model, system_prompt, provider, provider_config, training_config')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { success: false, error: 'Project not found' };
  }

  // Validate provider is Together.ai
  if (project.provider !== 'together') {
    return { success: false, error: 'Only Together.ai provider is currently supported' };
  }

  // Get API key from provider_config
  const providerConfig = project.provider_config as { api_key?: string };
  const apiKey = providerConfig.api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured. Please update project settings.',
    };
  }

  // Get training examples
  const { data: trainExamples, error: trainError } = await supabase
    .from('examples')
    .select('input, output, rewrite')
    .eq('project_id', projectId)
    .eq('split', 'train')
    .order('created_at', { ascending: true });

  if (trainError || !trainExamples || trainExamples.length === 0) {
    return { success: false, error: 'No training examples found. Run split first.' };
  }

  // Get validation examples
  const { data: valExamples, error: valError } = await supabase
    .from('examples')
    .select('input, output, rewrite')
    .eq('project_id', projectId)
    .eq('split', 'val')
    .order('created_at', { ascending: true });

  if (valError || !valExamples || valExamples.length === 0) {
    return { success: false, error: 'No validation examples found. Run split first.' };
  }

  // Parse training config
  const trainingConfig = project.training_config as TrainingConfig;

  try {
    // Import provider functions (dynamic to avoid server-side issues)
    const { formatExamplesToJSONL, uploadTrainingFile, createFineTuneJob } =
      await import('@/lib/providers/together');

    // Format examples to JSONL
    const trainJSONL = formatExamplesToJSONL(trainExamples, project.system_prompt);
    const valJSONL = formatExamplesToJSONL(valExamples, project.system_prompt);

    // Create training run record (status: uploading)
    const { data: run, error: runError } = await supabase
      .from('training_runs')
      .insert({
        project_id: projectId,
        provider: project.provider,
        base_model: project.base_model,
        status: 'uploading',
        config: trainingConfig,
        example_count: trainExamples.length + valExamples.length,
        train_count: trainExamples.length,
        val_count: valExamples.length,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (runError || !run) {
      return { success: false, error: 'Failed to create training run record' };
    }

    // Upload training file
    const trainFileId = await uploadTrainingFile(trainJSONL, apiKey, 'train.jsonl');

    // Upload validation file
    const valFileId = await uploadTrainingFile(valJSONL, apiKey, 'val.jsonl');

    // Update status to queued
    await supabase.from('training_runs').update({ status: 'queued' }).eq('id', run.id);

    // Create fine-tune job
    const jobId = await createFineTuneJob({
      apiKey,
      baseModel: project.base_model,
      trainingFileId: trainFileId,
      validationFileId: valFileId,
      epochs: trainingConfig.epochs,
      batchSize: trainingConfig.batch_size,
      learningRate: trainingConfig.learning_rate,
      loraR: trainingConfig.lora_r,
      loraAlpha: trainingConfig.lora_alpha,
      loraDropout: trainingConfig.lora_dropout,
    });

    // Update run with job ID and status
    await supabase
      .from('training_runs')
      .update({
        provider_job_id: jobId,
        status: 'training',
        started_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    revalidatePath('/train');
    revalidatePath('/dashboard');
    return { success: true, runId: run.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function pollTrainingStatus(runId: string): Promise<{
  success: boolean;
  run?: {
    id: string;
    status: string;
    model_id: string | null;
    error: string | null;
  };
  error?: string;
}> {
  const { supabase, user } = await getAuthUser();

  // Get training run
  const { data: run, error: runError } = await supabase
    .from('training_runs')
    .select('id, project_id, provider, provider_job_id, status, model_id, error')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return { success: false, error: 'Training run not found' };
  }

  // If already in terminal state, just return current status
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
    return {
      success: true,
      run: {
        id: run.id,
        status: run.status,
        model_id: run.model_id,
        error: run.error,
      },
    };
  }

  // Get project to fetch API key
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('provider_config')
    .eq('id', run.project_id)
    .single();

  if (projectError || !project) {
    return { success: false, error: 'Project not found' };
  }

  const providerConfig = project.provider_config as { api_key?: string };
  const apiKey = providerConfig.api_key;

  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  if (!run.provider_job_id) {
    return { success: false, error: 'No provider job ID found' };
  }

  try {
    // Poll Together.ai for job status
    const { getJobStatus } = await import('@/lib/providers/together');
    const jobStatus = await getJobStatus(run.provider_job_id, apiKey);

    // Map Together.ai status to our status
    // Together.ai statuses: "pending", "queued", "running", "succeeded", "failed", "cancelled"
    const statusMap: Record<string, string> = {
      pending: 'queued',
      queued: 'queued',
      running: 'training',
      succeeded: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
    };

    const newStatus = statusMap[jobStatus.status] ?? run.status;

    // Prepare update data
    const updateData: {
      status: string;
      model_id?: string | null;
      error?: string | null;
      completed_at?: string;
    } = {
      status: newStatus,
    };

    if (jobStatus.fine_tuned_model) {
      updateData.model_id = jobStatus.fine_tuned_model;
    }

    if (jobStatus.error) {
      updateData.error = jobStatus.error;
    }

    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
      updateData.completed_at = new Date().toISOString();
    }

    // Update run in DB
    await supabase.from('training_runs').update(updateData).eq('id', run.id);

    // Revalidate when run reaches terminal state
    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
      revalidatePath('/train');
      revalidatePath('/dashboard');
    }

    return {
      success: true,
      run: {
        id: run.id,
        status: newStatus,
        model_id: updateData.model_id ?? run.model_id,
        error: updateData.error ?? run.error,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function cancelTraining(runId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { supabase, user } = await getAuthUser();

  // Get training run
  const { data: run, error: runError } = await supabase
    .from('training_runs')
    .select('id, project_id, provider, provider_job_id, status')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return { success: false, error: 'Training run not found' };
  }

  // Check if run can be cancelled
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
    return { success: false, error: 'Training run is already in a terminal state' };
  }

  if (!run.provider_job_id) {
    // If no job ID yet, just mark as cancelled
    await supabase
      .from('training_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    revalidatePath('/train');
    revalidatePath('/dashboard');
    return { success: true };
  }

  // Get project to fetch API key
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('provider_config')
    .eq('id', run.project_id)
    .single();

  if (projectError || !project) {
    return { success: false, error: 'Project not found' };
  }

  const providerConfig = project.provider_config as { api_key?: string };
  const apiKey = providerConfig.api_key;

  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  try {
    // Cancel job via Together.ai API
    const { cancelFineTuneJob } = await import('@/lib/providers/together');
    await cancelFineTuneJob(run.provider_job_id, apiKey);

    // Update run status
    await supabase
      .from('training_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    revalidatePath('/train');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export type TrainingRunRow = {
  id: string;
  version: number;
  status: string;
  model_id: string | null;
  example_count: number;
  duration: number | null; // in minutes
  cost_estimate: number | null;
  cost_actual: number | null;
  eval_score: number | null;
  created_at: string;
  completed_at: string | null;
};

export async function getAllTrainingRuns(projectId: string): Promise<{
  data: TrainingRunRow[] | null;
  error?: string;
}> {
  const { supabase } = await getAuthUser();

  // Get all training runs for the project
  const { data: runs, error: runsError } = await supabase
    .from('training_runs')
    .select(
      'id, status, model_id, example_count, cost_estimate, cost_actual, created_at, started_at, completed_at',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (runsError) {
    return { data: null, error: runsError.message };
  }

  if (!runs) {
    return { data: [], error: undefined };
  }

  // Get evaluation scores for completed runs
  const completedRunIds = runs.filter((r) => r.status === 'completed').map((r) => r.id);

  let evalScores: Record<string, number> = {};

  if (completedRunIds.length > 0) {
    const { data: evals } = await supabase
      .from('evaluations')
      .select('training_run_id, model_score')
      .in('training_run_id', completedRunIds);

    if (evals) {
      // Calculate average eval score per run
      const scoresByRun: Record<string, number[]> = {};
      evals.forEach((e) => {
        if (e.model_score !== null) {
          if (!scoresByRun[e.training_run_id]) {
            scoresByRun[e.training_run_id] = [];
          }
          scoresByRun[e.training_run_id].push(e.model_score);
        }
      });

      Object.entries(scoresByRun).forEach(([runId, scores]) => {
        if (scores.length > 0) {
          evalScores[runId] = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        }
      });
    }
  }

  // Map runs to table rows with calculated fields
  const rows: TrainingRunRow[] = runs.map((run, index) => {
    // Calculate duration in minutes
    let duration: number | null = null;
    if (run.started_at && run.completed_at) {
      const start = new Date(run.started_at).getTime();
      const end = new Date(run.completed_at).getTime();
      duration = Math.round((end - start) / (1000 * 60));
    }

    return {
      id: run.id,
      version: runs.length - index, // Descending version numbers
      status: run.status,
      model_id: run.model_id,
      example_count: run.example_count,
      duration,
      cost_estimate: run.cost_estimate,
      cost_actual: run.cost_actual,
      eval_score: evalScores[run.id] ?? null,
      created_at: run.created_at,
      completed_at: run.completed_at,
    };
  });

  return { data: rows };
}
