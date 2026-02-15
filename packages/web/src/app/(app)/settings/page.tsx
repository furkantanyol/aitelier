import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsContent } from '@/components/settings-content';
import { Skeleton } from '@/components/ui/skeleton';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get('active_project')?.value;

  if (!activeProjectId) {
    redirect('/setup');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your project configuration, team members, and training defaults
        </p>
      </div>

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent projectId={activeProjectId} />
      </Suspense>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="mb-4 h-4 w-96" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
