import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReadinessStatus = 'ready' | 'almost' | 'not-ready';

export function ReadinessIndicator({
  qualityCount,
  trainCount,
  valCount,
}: {
  qualityCount: number;
  trainCount: number;
  valCount: number;
}) {
  // Determine readiness status
  // Ready: 20+ quality examples, at least 10 in train split, at least 2 in val split
  // Almost: 10+ quality examples OR has some splits
  // Not ready: less than 10 quality examples
  const hasEnoughQuality = qualityCount >= 20;
  const hasGoodTrainSplit = trainCount >= 10;
  const hasGoodValSplit = valCount >= 2;

  let status: ReadinessStatus;
  let icon: React.ReactNode;
  let title: string;
  let description: string;
  let cardClassName: string;

  if (hasEnoughQuality && hasGoodTrainSplit && hasGoodValSplit) {
    status = 'ready';
    icon = <CheckCircle2 className="h-5 w-5 text-green-500" />;
    title = 'Ready to Train';
    description = 'You have enough quality examples and a balanced train/val split.';
    cardClassName = 'border-green-500/50 bg-green-500/5';
  } else if (qualityCount >= 10 || (trainCount > 0 && valCount > 0)) {
    status = 'almost';
    icon = <AlertCircle className="h-5 w-5 text-yellow-500" />;
    title = 'Almost Ready';

    const needed: string[] = [];
    if (!hasEnoughQuality) {
      needed.push(`${20 - qualityCount} more quality examples`);
    }
    if (!hasGoodTrainSplit) {
      needed.push(`${Math.max(0, 10 - trainCount)} more in train split`);
    }
    if (!hasGoodValSplit) {
      needed.push(`${Math.max(0, 2 - valCount)} more in val split`);
    }

    description = `Need ${needed.join(', ')}.`;
    cardClassName = 'border-yellow-500/50 bg-yellow-500/5';
  } else {
    status = 'not-ready';
    icon = <XCircle className="h-5 w-5 text-muted-foreground" />;
    title = 'Not Ready';
    description = `You need at least 20 quality examples to start training. Currently: ${qualityCount}`;
    cardClassName = '';
  }

  return (
    <Card className={cn('transition-colors', cardClassName)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
