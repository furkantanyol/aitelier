import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plus, Star, LayoutGrid, Zap } from 'lucide-react';

type ProjectState = {
  totalExamples: number;
  ratedCount: number;
  qualityCount: number;
  trainCount: number;
  valCount: number;
  modelsTrainedCount: number;
};

type Suggestion = {
  title: string;
  description: string;
  action: {
    label: string;
    href: string;
  };
  icon: typeof Plus;
};

function getSuggestion(state: ProjectState): Suggestion {
  // No examples yet
  if (state.totalExamples === 0) {
    return {
      title: 'Add your first training example',
      description:
        'Start by adding a few examples of how you want your model to behave. You can add them manually or import from JSONL.',
      action: {
        label: 'Add Examples',
        href: '/add',
      },
      icon: Plus,
    };
  }

  // Has examples but none rated
  if (state.ratedCount === 0) {
    return {
      title: 'Rate your examples',
      description:
        'Review and rate your training examples to identify which ones are high quality. Aim for at least 20-30 quality examples.',
      action: {
        label: 'Start Rating',
        href: '/rate',
      },
      icon: Star,
    };
  }

  // Has rated examples but not enough quality examples
  if (state.qualityCount < 20) {
    return {
      title: 'Add more quality examples',
      description: `You have ${state.qualityCount} quality examples. Add and rate more to reach at least 20-30 before training.`,
      action: {
        label: 'Add More',
        href: '/add',
      },
      icon: Plus,
    };
  }

  // Has quality examples but no train/val split
  if (state.trainCount === 0 && state.valCount === 0) {
    return {
      title: 'Split your dataset',
      description:
        'Create a train/validation split to prepare for fine-tuning. We recommend an 80/20 split.',
      action: {
        label: 'Manage Splits',
        href: '/train',
      },
      icon: LayoutGrid,
    };
  }

  // Ready to train but hasn't trained yet
  if (state.modelsTrainedCount === 0 && state.trainCount >= 15) {
    return {
      title: 'Start your first training run',
      description:
        'Your dataset is ready! Configure training parameters and kick off your first fine-tuning job.',
      action: {
        label: 'Start Training',
        href: '/train',
      },
      icon: Zap,
    };
  }

  // Has trained models - suggest evaluation
  if (state.modelsTrainedCount > 0) {
    return {
      title: 'Evaluate your models',
      description:
        'Test your fine-tuned models against the base model to measure improvement and validate quality.',
      action: {
        label: 'Run Evaluation',
        href: '/eval',
      },
      icon: Star,
    };
  }

  // Default fallback
  return {
    title: 'Keep improving',
    description:
      'Add more examples, rate them, and run new training iterations to improve quality.',
    action: {
      label: 'Add Examples',
      href: '/add',
    },
    icon: Plus,
  };
}

export function WhatsNext({ state }: { state: ProjectState }) {
  const suggestion = getSuggestion(state);
  const Icon = suggestion.icon;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          <CardTitle className="text-base">What&apos;s next?</CardTitle>
        </div>
        <CardDescription className="sr-only">Suggested next action</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="mb-1 font-medium">{suggestion.title}</h4>
          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
        </div>
        <Button asChild className="w-full">
          <a href={suggestion.action.href}>
            {suggestion.action.label}
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
