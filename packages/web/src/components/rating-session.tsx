'use client';

import { use, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { RatingCard } from '@/components/rating-card';
import { useProject } from '@/components/project-provider';

type Example = {
  id: string;
  input: string;
  output: string;
  rating: number | null;
  rewrite: string | null;
  created_at: string;
};

type Props = {
  initialExamplesPromise: Promise<{ examples: Example[] }>;
};

export function RatingSession({ initialExamplesPromise }: Props) {
  const initialData = use(initialExamplesPromise);
  const { activeProjectId } = useProject();

  const [examples] = useState<Example[]>(initialData.examples);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rated, setRated] = useState(0);
  const [ratingSum, setRatingSum] = useState(0);

  if (!activeProjectId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No projects yet. Create one first in{' '}
            <a href="/setup" className="text-primary underline">
              Setup
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  const current = examples[currentIndex];
  const total = examples.length;
  const remaining = total - currentIndex;

  const handleRated = (rating: number | null) => {
    if (rating !== null) {
      setRated((r) => r + 1);
      setRatingSum((s) => s + rating);
    }
    setCurrentIndex((i) => i + 1);
  };

  return (
    <div className="space-y-4">
      {/* Progress + Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {remaining > 0 ? `${currentIndex + 1} of ${total} unrated` : `${total} examples reviewed`}
        </span>
        {rated > 0 && (
          <span>
            Rated {rated} this session (avg: {(ratingSum / rated).toFixed(1)})
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
      )}

      {/* Card or empty state */}
      <AnimatePresence mode="wait">
        {!current ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-lg font-medium">All caught up!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {total === 0
                  ? 'No unrated examples. Add some first.'
                  : `You've reviewed all ${total} examples.`}
              </p>
              {rated > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Session: {rated} rated, avg {(ratingSum / rated).toFixed(1)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <RatingCard example={current} onRated={handleRated} />
        )}
      </AnimatePresence>
    </div>
  );
}
