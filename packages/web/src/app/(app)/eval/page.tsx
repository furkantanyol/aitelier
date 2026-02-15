import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EvalSetup } from './eval-setup';
import { getEvalSetupData } from './actions';

export default async function EvalPage() {
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get('active_project')?.value;

  if (!activeProjectId) {
    redirect('/setup');
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Evaluation</h1>
        <p className="mt-2 text-muted-foreground">
          Compare your fine-tuned model against the baseline using blind A/B testing.
        </p>
      </div>

      <Suspense fallback={<EvalSetupSkeleton />}>
        <EvalSetupContent projectId={activeProjectId} />
      </Suspense>
    </div>
  );
}

async function EvalSetupContent({ projectId }: { projectId: string }) {
  const { data, error } = await getEvalSetupData(projectId);

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>{error ?? 'Failed to load evaluation data'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <EvalSetup data={data} projectId={projectId} />;
}

function EvalSetupSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
