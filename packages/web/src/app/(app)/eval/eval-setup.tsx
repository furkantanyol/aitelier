'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { startEvaluation, type EvalSetupData } from './actions';

type EvalSetupProps = {
  data: EvalSetupData;
  projectId: string;
};

export function EvalSetup({ data, projectId }: EvalSetupProps) {
  const router = useRouter();
  const [modelA, setModelA] = useState<string>('');
  const [modelB, setModelB] = useState<string>('baseline');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { modelOptions, valExampleCount } = data;

  // Auto-select first fine-tuned model as Model A if available
  const defaultModelA = modelOptions.find((m) => m.type === 'fine-tuned')?.id ?? '';

  const canStart = modelA && modelB && modelA !== modelB && valExampleCount > 0 && !isGenerating;

  const handleStartEvaluation = async () => {
    if (!canStart) return;

    setIsGenerating(true);
    setError(null);

    const result = await startEvaluation(projectId, modelA, modelB);

    if (result.success && result.evaluationId) {
      // Redirect to comparison UI
      router.push(`/eval/${result.evaluationId}`);
    } else {
      setError(result.error ?? 'Failed to start evaluation');
      setIsGenerating(false);
    }
  };

  const hasNoFineTunedModels = modelOptions.filter((m) => m.type === 'fine-tuned').length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup Evaluation</CardTitle>
        <CardDescription>
          Select two models to compare on your validation set. Results will be presented in a blind
          A/B format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validation Set Info */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-4">
          {valExampleCount > 0 ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Validation set ready</p>
                <p className="text-sm text-muted-foreground">
                  {valExampleCount} example{valExampleCount !== 1 ? 's' : ''} will be evaluated
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">No validation examples</p>
                <p className="text-sm text-muted-foreground">
                  Add examples and create a validation split first
                </p>
              </div>
            </>
          )}
        </div>

        {/* No Fine-Tuned Models Warning */}
        {hasNoFineTunedModels && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No completed training runs found. Train a model first to compare against the baseline.
            </AlertDescription>
          </Alert>
        )}

        {/* Model A Selector */}
        <div className="space-y-2">
          <Label htmlFor="model-a">Model A</Label>
          <Select value={modelA || defaultModelA} onValueChange={setModelA} disabled={isGenerating}>
            <SelectTrigger id="model-a">
              <SelectValue placeholder="Select first model" />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model B Selector */}
        <div className="space-y-2">
          <Label htmlFor="model-b">Model B</Label>
          <Select value={modelB} onValueChange={setModelB} disabled={isGenerating}>
            <SelectTrigger id="model-b">
              <SelectValue placeholder="Select second model" />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Same Model Warning */}
        {modelA && modelB && modelA === modelB && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please select two different models to compare.</AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Start Button */}
        <Button onClick={handleStartEvaluation} disabled={!canStart} className="w-full" size="lg">
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating outputs...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Evaluation
            </>
          )}
        </Button>

        {canStart && !isGenerating && (
          <p className="text-center text-sm text-muted-foreground">
            This will generate {valExampleCount * 2} completions and may take a few minutes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
