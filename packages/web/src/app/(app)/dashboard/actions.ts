'use server';

import { createClient } from '@/lib/supabase/server';

export type DashboardMetrics = {
  totalExamples: number;
  ratedCount: number;
  qualityCount: number;
  modelsTrainedCount: number;
};

export type RatingDistribution = {
  rating: number;
  count: number;
  trainCount: number;
  valCount: number;
};

export type SplitStats = {
  trainCount: number;
  valCount: number;
  unassignedCount: number;
};

export async function getDashboardMetrics(projectId: string): Promise<{
  metrics: DashboardMetrics | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { metrics: null, error: 'Not authenticated' };
  }

  // Get project quality threshold
  const { data: project } = await supabase
    .from('projects')
    .select('quality_threshold')
    .eq('id', projectId)
    .single();

  if (!project) {
    return { metrics: null, error: 'Project not found' };
  }

  const threshold = project.quality_threshold ?? 8;

  // Get all examples for this project
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('rating')
    .eq('project_id', projectId);

  if (examplesError) {
    return { metrics: null, error: examplesError.message };
  }

  // Get completed training runs count
  const { count: modelsTrainedCount, error: runsError } = await supabase
    .from('training_runs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'completed');

  if (runsError) {
    return { metrics: null, error: runsError.message };
  }

  // Calculate metrics
  const totalExamples = examples?.length ?? 0;
  const ratedCount = examples?.filter((e) => e.rating !== null).length ?? 0;
  const qualityCount =
    examples?.filter((e) => e.rating !== null && e.rating >= threshold).length ?? 0;

  return {
    metrics: {
      totalExamples,
      ratedCount,
      qualityCount,
      modelsTrainedCount: modelsTrainedCount ?? 0,
    },
  };
}

export async function getRatingDistribution(projectId: string): Promise<{
  distribution: RatingDistribution[] | null;
  splitStats: SplitStats | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { distribution: null, splitStats: null, error: 'Not authenticated' };
  }

  // Get all examples with ratings
  const { data: examples, error: examplesError } = await supabase
    .from('examples')
    .select('rating, split')
    .eq('project_id', projectId);

  if (examplesError) {
    return { distribution: null, splitStats: null, error: examplesError.message };
  }

  // Build distribution by rating (1-10)
  const distributionMap = new Map<
    number,
    { count: number; trainCount: number; valCount: number }
  >();

  // Initialize all ratings 1-10 with zero counts
  for (let i = 1; i <= 10; i++) {
    distributionMap.set(i, { count: 0, trainCount: 0, valCount: 0 });
  }

  // Count examples by rating and split
  let trainCount = 0;
  let valCount = 0;
  let unassignedCount = 0;

  examples?.forEach((example) => {
    // Count by split (all examples)
    if (example.split === 'train') {
      trainCount += 1;
    } else if (example.split === 'val') {
      valCount += 1;
    } else {
      unassignedCount += 1;
    }

    // Count by rating (only rated examples)
    if (example.rating !== null) {
      const entry = distributionMap.get(example.rating)!;
      entry.count += 1;

      if (example.split === 'train') {
        entry.trainCount += 1;
      } else if (example.split === 'val') {
        entry.valCount += 1;
      }
    }
  });

  // Convert map to array
  const distribution: RatingDistribution[] = Array.from(distributionMap.entries()).map(
    ([rating, data]) => ({
      rating,
      count: data.count,
      trainCount: data.trainCount,
      valCount: data.valCount,
    }),
  );

  return {
    distribution,
    splitStats: {
      trainCount,
      valCount,
      unassignedCount,
    },
  };
}

export type TrainingRun = {
  id: string;
  status: 'pending' | 'uploading' | 'queued' | 'training' | 'completed' | 'failed' | 'cancelled';
  example_count: number;
  model_id: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

export async function getTrainingRuns(projectId: string): Promise<{
  runs: TrainingRun[] | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { runs: null, error: 'Not authenticated' };
  }

  const { data: runs, error: runsError } = await supabase
    .from('training_runs')
    .select('id, status, example_count, model_id, created_at, completed_at, error')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (runsError) {
    return { runs: null, error: runsError.message };
  }

  // Cast status to the correct type (Supabase returns generic string)
  const typedRuns = runs as TrainingRun[];

  return { runs: typedRuns };
}

export type ActivityEvent = {
  id: string;
  type: 'example_added' | 'example_rated' | 'training_started' | 'training_completed';
  description: string;
  timestamp: string;
  user_email?: string;
};

export async function getRecentActivity(projectId: string): Promise<{
  activities: ActivityEvent[] | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { activities: null, error: 'Not authenticated' };
  }

  // Get recent examples (created and rated)
  const { data: examples } = await supabase
    .from('examples')
    .select('id, created_at, rated_at, created_by, rated_by')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get recent training runs
  const { data: runs } = await supabase
    .from('training_runs')
    .select('id, status, created_at, completed_at, created_by')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get user emails for attribution (using auth.users)
  const userIds = new Set<string>();
  examples?.forEach((e) => {
    if (e.created_by) userIds.add(e.created_by);
    if (e.rated_by) userIds.add(e.rated_by);
  });
  runs?.forEach((r) => {
    if (r.created_by) userIds.add(r.created_by);
  });

  // Fetch user emails (only works if we have access to auth.users)
  // For now, we'll skip this and just show user IDs or anonymous
  const userEmailMap = new Map<string, string>();

  // Build activity list
  const activities: ActivityEvent[] = [];

  // Add example creation events
  examples?.forEach((example) => {
    activities.push({
      id: `example-created-${example.id}`,
      type: 'example_added',
      description: 'Added a new example',
      timestamp: example.created_at,
      user_email: userEmailMap.get(example.created_by) ?? undefined,
    });

    if (example.rated_at) {
      activities.push({
        id: `example-rated-${example.id}`,
        type: 'example_rated',
        description: 'Rated an example',
        timestamp: example.rated_at,
        user_email: example.rated_by
          ? (userEmailMap.get(example.rated_by) ?? undefined)
          : undefined,
      });
    }
  });

  // Add training run events
  runs?.forEach((run) => {
    activities.push({
      id: `training-started-${run.id}`,
      type: 'training_started',
      description: 'Started training run',
      timestamp: run.created_at,
      user_email: userEmailMap.get(run.created_by) ?? undefined,
    });

    if (run.completed_at && run.status === 'completed') {
      activities.push({
        id: `training-completed-${run.id}`,
        type: 'training_completed',
        description: 'Training run completed',
        timestamp: run.completed_at,
        user_email: userEmailMap.get(run.created_by) ?? undefined,
      });
    }
  });

  // Sort by timestamp descending and limit to 20
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivities = activities.slice(0, 20);

  return { activities: recentActivities };
}
