import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { MetricCard, MetricCardSkeleton } from '@/components/metric-card';
import { RatingDistributionChart } from '@/components/rating-distribution-chart';
import { ReadinessIndicator } from '@/components/readiness-indicator';
import { TrainingTimeline } from '@/components/training-timeline';
import { ActivityFeed } from '@/components/activity-feed';
import { WhatsNext } from '@/components/whats-next';
import {
  getDashboardMetrics,
  getRatingDistribution,
  getTrainingRuns,
  getRecentActivity,
} from './actions';
import { Database, BarChart3, CheckCircle2, Sparkles } from 'lucide-react';
import { getUserProjects } from '@/lib/projects';
import { Skeleton } from '@/components/ui/skeleton';

async function DashboardMetrics({ projectId }: { projectId: string }) {
  const { metrics, error } = await getDashboardMetrics(projectId);

  if (error || !metrics) {
    return (
      <div className="text-sm text-destructive">
        Failed to load metrics: {error ?? 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Examples"
        value={metrics.totalExamples}
        description="All training examples in this project"
        icon={<Database className="h-4 w-4" />}
      />
      <MetricCard
        label="Rated"
        value={metrics.ratedCount}
        description={`${metrics.totalExamples > 0 ? Math.round((metrics.ratedCount / metrics.totalExamples) * 100) : 0}% of total examples`}
        icon={<CheckCircle2 className="h-4 w-4" />}
      />
      <MetricCard
        label="Quality Examples"
        value={metrics.qualityCount}
        description="Examples meeting quality threshold"
        icon={<BarChart3 className="h-4 w-4" />}
      />
      <MetricCard
        label="Models Trained"
        value={metrics.modelsTrainedCount}
        description="Completed fine-tuning runs"
        icon={<Sparkles className="h-4 w-4" />}
      />
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>
  );
}

async function DashboardCharts({ projectId }: { projectId: string }) {
  const [metricsResult, distributionResult] = await Promise.all([
    getDashboardMetrics(projectId),
    getRatingDistribution(projectId),
  ]);

  if (metricsResult.error || !metricsResult.metrics) {
    return (
      <div className="text-sm text-destructive">
        Failed to load metrics: {metricsResult.error ?? 'Unknown error'}
      </div>
    );
  }

  if (
    distributionResult.error ||
    !distributionResult.distribution ||
    !distributionResult.splitStats
  ) {
    return (
      <div className="text-sm text-destructive">
        Failed to load distribution: {distributionResult.error ?? 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <RatingDistributionChart
          distribution={distributionResult.distribution}
          splitStats={distributionResult.splitStats}
        />
      </div>
      <div className="space-y-6">
        <ReadinessIndicator
          qualityCount={metricsResult.metrics.qualityCount}
          trainCount={distributionResult.splitStats.trainCount}
          valCount={distributionResult.splitStats.valCount}
        />
        <WhatsNext
          state={{
            totalExamples: metricsResult.metrics.totalExamples,
            ratedCount: metricsResult.metrics.ratedCount,
            qualityCount: metricsResult.metrics.qualityCount,
            trainCount: distributionResult.splitStats.trainCount,
            valCount: distributionResult.splitStats.valCount,
            modelsTrainedCount: metricsResult.metrics.modelsTrainedCount,
          }}
        />
      </div>
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Skeleton className="h-[400px] w-full" />
      </div>
      <div>
        <Skeleton className="h-[150px] w-full" />
      </div>
    </div>
  );
}

async function DashboardActivity({ projectId }: { projectId: string }) {
  const [runsResult, activityResult] = await Promise.all([
    getTrainingRuns(projectId),
    getRecentActivity(projectId),
  ]);

  if (runsResult.error || !runsResult.runs) {
    return (
      <div className="text-sm text-destructive">
        Failed to load training runs: {runsResult.error ?? 'Unknown error'}
      </div>
    );
  }

  if (activityResult.error || !activityResult.activities) {
    return (
      <div className="text-sm text-destructive">
        Failed to load activity: {activityResult.error ?? 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TrainingTimeline runs={runsResult.runs} />
      <ActivityFeed activities={activityResult.activities} />
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-[400px] w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  let activeProjectId = cookieStore.get('active_project')?.value ?? null;

  // Fallback to first project if cookie isn't set yet
  if (!activeProjectId) {
    const projects = await getUserProjects();
    activeProjectId = projects[0]?.id ?? null;
  }

  if (!activeProjectId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a project to view metrics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your fine-tuning project</p>
      </div>

      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardMetrics projectId={activeProjectId} />
      </Suspense>

      <Suspense fallback={<ChartsSkeleton />}>
        <DashboardCharts projectId={activeProjectId} />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <DashboardActivity projectId={activeProjectId} />
      </Suspense>
    </div>
  );
}
