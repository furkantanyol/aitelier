import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/server';
import { TrainingStatusMonitor } from '@/components/training-status-monitor';

type Props = {
  params: Promise<{ runId: string }>;
};

async function getTrainingRun(runId: string) {
  const { supabase } = await getAuthUser();

  const { data, error } = await supabase
    .from('training_runs')
    .select(
      `
      id,
      provider,
      provider_job_id,
      model_id,
      base_model,
      status,
      config,
      example_count,
      train_count,
      val_count,
      started_at,
      completed_at,
      error,
      created_at
    `,
    )
    .eq('id', runId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function TrainingRunPage({ params }: Props) {
  const { runId } = await params;
  const run = await getTrainingRun(runId);

  if (!run) {
    notFound();
  }

  return (
    <TrainingStatusMonitor
      runId={run.id}
      initialStatus={run.status}
      initialModelId={run.model_id}
      initialError={run.error}
      baseModel={run.base_model}
      trainCount={run.train_count}
      valCount={run.val_count}
      providerJobId={run.provider_job_id}
      createdAt={run.created_at}
    />
  );
}
