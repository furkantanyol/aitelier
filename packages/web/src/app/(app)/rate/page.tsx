import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getExamples, type FilterType, type SortType } from './actions';
import { RatingSession } from '@/components/rating-session';
import { RatingControls } from '@/components/rating-controls';
import { Card, CardContent } from '@/components/ui/card';
import { getUserProjects } from '@/lib/projects';

type PageProps = {
  searchParams: Promise<{
    filter?: string;
    sort?: string;
  }>;
};

export default async function RatePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  let activeProjectId = cookieStore.get('active_project')?.value ?? null;

  // Fallback to first project if cookie isn't set yet
  if (!activeProjectId) {
    const projects = await getUserProjects();
    activeProjectId = projects[0]?.id ?? null;
  }

  // Parse search params
  const filter = (params.filter ?? 'unrated') as FilterType;
  const sort = (params.sort ?? 'newest') as SortType;

  const initialExamplesPromise = activeProjectId
    ? getExamples(activeProjectId, filter, sort)
    : Promise.resolve({ examples: [] });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rate Examples</h1>
        <p className="text-sm text-muted-foreground">
          Review and rate training examples to build a quality dataset.
        </p>
      </div>

      <RatingControls filter={filter} sort={sort} />

      <Suspense
        fallback={
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Loading examples...
            </CardContent>
          </Card>
        }
      >
        <RatingSession
          key={`${activeProjectId}-${filter}-${sort}`}
          initialExamplesPromise={initialExamplesPromise}
        />
      </Suspense>
    </div>
  );
}
