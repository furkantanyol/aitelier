import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ResultsReveal } from './results-reveal';
import { getEvaluationResults, getHistoricalEvalTrends } from '../../actions';

type PageProps = {
  params: Promise<{ evaluationId: string }>;
};

export default async function EvaluationResultsPage({ params }: PageProps) {
  const { evaluationId } = await params;
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get('active_project')?.value;

  if (!activeProjectId) {
    redirect('/setup');
  }

  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsContent evaluationId={evaluationId} projectId={activeProjectId} />
    </Suspense>
  );
}

async function ResultsContent({
  evaluationId,
  projectId,
}: {
  evaluationId: string;
  projectId: string;
}) {
  const { data, error } = await getEvaluationResults(evaluationId);
  const { data: trends } = await getHistoricalEvalTrends(projectId);

  if (error || !data) {
    return (
      <div className="container flex min-h-[80vh] max-w-4xl items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">
              {error ?? 'Failed to load evaluation results'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ResultsReveal results={data} trends={trends ?? []} />;
}

function ResultsSkeleton() {
  return (
    <div className="container max-w-6xl py-8">
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
