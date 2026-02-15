'use server';

import { getAuthUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, fetchModels, type TogetherModel } from '@/lib/providers/together';

// Re-export provider functions so existing imports from setup/actions still work
export { validateApiKey, fetchModels, type TogetherModel };

type SaveProjectInput = {
  name: string;
  description: string;
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  trainingConfig: {
    epochs: number;
    batch_size: number;
    learning_rate: number;
    lora_r: number;
    lora_alpha: number;
    lora_dropout: number;
  };
  invites: Array<{ email: string; role: 'trainer' | 'rater' }>;
};

export async function saveProject(input: SaveProjectInput) {
  const { supabase, user } = await getAuthUser();

  // Insert project (RLS: any authenticated user where created_by = auth.uid())
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: input.name,
      system_prompt: input.systemPrompt || null,
      provider: input.provider,
      base_model: input.model,
      provider_config: { api_key: input.apiKey },
      training_config: input.trainingConfig,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? 'Failed to create project' };
  }

  // Add creator as owner (RLS: user can add themselves as owner)
  const { error: memberError } = await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    role: 'owner',
  });

  if (memberError) {
    return { error: memberError.message };
  }

  // Send invites (best-effort — needs admin client for auth.admin API)
  if (input.invites.length > 0) {
    const admin = createAdminClient();
    for (const invite of input.invites) {
      const { data: inviteData } = await admin.auth.admin.inviteUserByEmail(invite.email);

      if (inviteData?.user) {
        await admin.from('project_members').insert({
          project_id: project.id,
          user_id: inviteData.user.id,
          role: invite.role,
        });
      }
    }
  }

  return { projectId: project.id };
}
