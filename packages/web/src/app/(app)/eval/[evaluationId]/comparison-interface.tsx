'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { saveEvaluationScore, type EvaluationItem } from '../actions';

type ComparisonInterfaceProps = {
  items: EvaluationItem[];
  evaluationId: string;
};

export function ComparisonInterface({ items, evaluationId }: ComparisonInterfaceProps) {
  const router = useRouter();

  // Compute initial index based on first unscored item
  const getInitialIndex = () => {
    const nextUnscoredIndex = items.findIndex((item) => item.preferred === null);
    return nextUnscoredIndex !== -1 ? nextUnscoredIndex : 0;
  };

  const [currentIndex, setCurrentIndex] = useState(getInitialIndex);
  const [scoreA, setScoreA] = useState<number | undefined>(undefined);
  const [scoreB, setScoreB] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const currentItem = items[currentIndex];
  const totalItems = items.length;
  const scoredCount = items.filter((item) => item.preferred !== null).length;
  const progress = (scoredCount / totalItems) * 100;

  const handlePreference = useCallback(
    async (preferred: 'a' | 'b' | 'tie') => {
      if (isSaving) return;

      setIsSaving(true);

      const result = await saveEvaluationScore(
        currentItem.id,
        currentItem.is_a_model,
        preferred,
        scoreA,
        scoreB,
      );

      setIsSaving(false);

      if (result.success) {
        // Reset scores
        setScoreA(undefined);
        setScoreB(undefined);

        // Check if all items are scored
        const allScored = items.every((item, idx) => {
          if (idx === currentIndex) return true; // Current item just scored
          return item.preferred !== null;
        });

        if (allScored) {
          // Redirect to results page (will be implemented in W4.3)
          router.push(`/eval/${evaluationId}/results`);
        } else {
          // Move to next unscored item
          const nextUnscoredIndex = items.findIndex(
            (item, idx) => idx > currentIndex && item.preferred === null,
          );
          if (nextUnscoredIndex !== -1) {
            setCurrentIndex(nextUnscoredIndex);
          } else {
            // Wrap around to find first unscored
            const firstUnscored = items.findIndex((item) => item.preferred === null);
            if (firstUnscored !== -1) {
              setCurrentIndex(firstUnscored);
            }
          }
        }
      }
    },
    [currentItem, currentIndex, items, scoreA, scoreB, isSaving, evaluationId, router],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (isSaving) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handlePreference('a');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handlePreference('b');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handlePreference('tie');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePreference, isSaving]);

  if (!currentItem) {
    return (
      <div className="container flex min-h-[80vh] max-w-4xl items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">All items scored!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Blind Comparison</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {totalItems}
            </span>
            <Progress value={progress} className="w-32" />
            <Badge variant="secondary">
              {scoredCount}/{totalItems} scored
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Input Context */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Input</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{currentItem.input}</p>
          </CardContent>
        </Card>

        {/* Response Cards */}
        <div className="grid flex-1 gap-6 md:grid-cols-2">
          {/* Response A */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Response A</CardTitle>
                {currentItem.preferred === (currentItem.is_a_model ? 'model' : 'baseline') && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex-1 overflow-auto">
                <p className="whitespace-pre-wrap text-sm">{currentItem.output_a}</p>
              </div>

              {/* Optional Score Slider */}
              <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-xs text-muted-foreground">Optional: Rate 1-10</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[scoreA ?? 5]}
                    onValueChange={(val) => setScoreA(val[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-8 text-center text-sm font-medium">{scoreA ?? '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Response B */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Response B</CardTitle>
                {currentItem.preferred === (currentItem.is_a_model ? 'baseline' : 'model') && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex-1 overflow-auto">
                <p className="whitespace-pre-wrap text-sm">{currentItem.output_b}</p>
              </div>

              {/* Optional Score Slider */}
              <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-xs text-muted-foreground">Optional: Rate 1-10</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[scoreB ?? 5]}
                    onValueChange={(val) => setScoreB(val[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-8 text-center text-sm font-medium">{scoreB ?? '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preference Buttons */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => handlePreference('a')}
              disabled={isSaving}
              size="lg"
              variant="outline"
              className="min-w-40"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}A is better
            </Button>
            <Button
              onClick={() => handlePreference('tie')}
              disabled={isSaving}
              size="lg"
              variant="outline"
              className="min-w-32"
            >
              Tie
            </Button>
            <Button
              onClick={() => handlePreference('b')}
              disabled={isSaving}
              size="lg"
              variant="outline"
              className="min-w-40"
            >
              B is better
            </Button>
          </div>

          {/* Keyboard Shortcuts Legend */}
          <p className="text-xs text-muted-foreground">
            Keyboard: <kbd className="rounded bg-muted px-1.5 py-0.5">A</kbd> = A is better ·{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5">T</kbd> = Tie ·{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5">B</kbd> = B is better
          </p>
        </div>
      </div>
    </div>
  );
}
