'use client';

import { TrainingRun } from '@/app/(app)/dashboard/actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';

type TrainingTimelineProps = {
  runs: TrainingRun[];
};

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary' as const,
    color: 'text-muted-foreground',
  },
  uploading: {
    label: 'Uploading',
    icon: Loader2,
    variant: 'secondary' as const,
    color: 'text-blue-500',
  },
  queued: {
    label: 'Queued',
    icon: Clock,
    variant: 'secondary' as const,
    color: 'text-yellow-500',
  },
  training: {
    label: 'Training',
    icon: Loader2,
    variant: 'default' as const,
    color: 'text-blue-500',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    variant: 'default' as const,
    color: 'text-green-500',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive' as const,
    color: 'text-destructive',
  },
  cancelled: {
    label: 'Cancelled',
    icon: AlertCircle,
    variant: 'outline' as const,
    color: 'text-muted-foreground',
  },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrainingTimeline({ runs }: TrainingTimelineProps) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Loader2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No training runs yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start your first training run to see it here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {runs.map((run, index) => {
            const config = statusConfig[run.status];
            const Icon = config.icon;
            const isActive = run.status === 'training' || run.status === 'uploading';

            return (
              <div
                key={run.id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                {/* Status Icon */}
                <div className={`flex-shrink-0 ${config.color}`}>
                  <Icon className={`h-4 w-4 ${isActive ? 'animate-spin' : ''}`} />
                </div>

                {/* Run Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Run {runs.length - index}</span>
                    <Badge variant={config.variant} className="text-xs">
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{run.example_count} examples</span>
                    <span>•</span>
                    <span>{formatDate(run.created_at)}</span>
                    {run.model_id && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[200px]" title={run.model_id}>
                          {run.model_id}
                        </span>
                      </>
                    )}
                  </div>
                  {run.error && (
                    <p className="text-xs text-destructive mt-1 truncate" title={run.error}>
                      {run.error}
                    </p>
                  )}
                </div>

                {/* Clickable indicator */}
                <div className="flex-shrink-0 text-xs text-muted-foreground">
                  <button
                    className="hover:text-foreground transition-colors"
                    onClick={() => {
                      // TODO: Navigate to /train/[runId] when that page is built
                      console.log('Navigate to run:', run.id);
                    }}
                  >
                    View →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
