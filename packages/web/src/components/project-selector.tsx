'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProject } from '@/components/project-provider';

export function ProjectSelector() {
  const router = useRouter();
  const { projects, activeProjectId, setActiveProject } = useProject();

  if (projects.length === 0) {
    return null;
  }

  const handleChange = (value: string) => {
    if (value === '__new') {
      router.push('/setup');
      return;
    }
    setActiveProject(value);
  };

  return (
    <Select value={activeProjectId ?? undefined} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex flex-col">
              <span>{p.name}</span>
              {p.base_model && (
                <span className="text-xs text-muted-foreground">
                  {p.base_model.split('/').pop()}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="__new">
          <span className="flex items-center gap-2">
            <Plus className="size-3.5" />
            New Project
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
