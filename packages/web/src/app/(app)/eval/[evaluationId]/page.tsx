import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonInterface } from './comparison-interface';
import { getEvaluationItems } from '../actions';

type PageProps = {
  params: Promise<{ evaluationId: string }>;
};

export default async function EvaluationPage({ params }: PageProps) {
  const { evaluationId } = await params;
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get('active_project')?.value;

  if (!activeProjectId) {
    redirect('/setup');
  }

  return (
    <Suspense fallback={<ComparisonSkeleton />}>
      <ComparisonContent evaluationId={evaluationId} />
    </Suspense>
  );
}

async function ComparisonContent({ evaluationId }: { evaluationId: string }) {
  const { data, error } = await getEvaluationItems(evaluationId);

  if (error || !data) {
    return (
      <div className="container flex min-h-[80vh] max-w-4xl items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">
              {error ?? 'Failed to load evaluation'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="container flex min-h-[80vh] max-w-4xl items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">No evaluation items found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ComparisonInterface items={data} evaluationId={evaluationId} />;
}

function ComparisonSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Input Card */}
        <Card>
          <CardContent className="p-6">
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>

        {/* Response Cards */}
        <div className="grid flex-1 gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="mb-4 h-6 w-16" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="mb-4 h-6 w-16" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
