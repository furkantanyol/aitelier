'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Check,
  X,
  ChevronDown,
  Trash2,
  Download,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getProjectSettings,
  updateProjectBasics,
  validateApiKey,
  fetchModels,
  updateProviderConfig,
  updateTrainingDefaults,
  getTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  removeMember,
  exportDataset,
  deleteProject,
  type TeamMember,
  type TogetherModel,
} from '@/app/(app)/settings/actions';

type ProjectSettings = {
  id: string;
  name: string;
  system_prompt: string | null;
  provider: string;
  base_model: string;
  provider_config: { api_key: string };
  training_config: {
    epochs: number;
    batch_size: number;
    learning_rate: number;
    lora_r: number;
    lora_alpha: number;
    lora_dropout: number;
  };
  quality_threshold: number;
};

export function SettingsContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      setLoading(true);
      const result = await getProjectSettings(projectId);
      if (result.project) {
        setProject(result.project as ProjectSettings);
      }
      setLoading(false);
    }
    loadProject();
  }, [projectId]);

  if (loading || !project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ProjectBasicsSection project={project} projectId={projectId} />
      <ProviderConfigSection project={project} projectId={projectId} />
      <TrainingDefaultsSection project={project} projectId={projectId} />
      <TeamManagementSection projectId={projectId} />
      <ExportSection projectId={projectId} />
      <DangerZoneSection projectId={projectId} projectName={project.name} router={router} />
    </div>
  );
}

// =============================================================================
// PROJECT BASICS
// =============================================================================

function ProjectBasicsSection({
  project,
  projectId,
}: {
  project: ProjectSettings;
  projectId: string;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.system_prompt ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateProjectBasics(projectId, name, description);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Project settings updated');
    }
  }

  const hasChanges = name !== project.name || description !== (project.system_prompt ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
        <CardDescription>Update your project name and description</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            placeholder="e.g. Customer Support Bot"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">
            System Prompt <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Define how your model should behave..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PROVIDER CONFIG
// =============================================================================

function ProviderConfigSection({
  project,
  projectId,
}: {
  project: ProjectSettings;
  projectId: string;
}) {
  const [apiKey, setApiKey] = useState(project.provider_config.api_key);
  const [model, setModel] = useState(project.base_model);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [models, setModels] = useState<(TogetherModel & { recommended: boolean })[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleTestConnection() {
    setKeyStatus('testing');
    setKeyError(null);

    const result = await validateApiKey(apiKey);

    if (result.valid) {
      setKeyStatus('valid');
      setModelsLoading(true);
      const modelsResult = await fetchModels(apiKey);
      setModels(modelsResult.models);
      setModelsError(modelsResult.error ?? null);
      setModelsLoading(false);
    } else {
      setKeyStatus('invalid');
      setKeyError(result.error ?? 'Invalid API key');
    }
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateProviderConfig(projectId, apiKey, model);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Provider configuration updated');
    }
  }

  const hasChanges = apiKey !== project.provider_config.api_key || model !== project.base_model;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Configuration</CardTitle>
        <CardDescription>Manage your Together.ai API key and base model</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <div className="flex gap-2">
            <Button variant="default" className="flex-1" disabled>
              Together.ai
            </Button>
            <Button variant="outline" className="flex-1" disabled>
              OpenAI
              <Badge variant="secondary" className="ml-2 text-xs">
                Soon
              </Badge>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API key</Label>
          <div className="flex gap-2">
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your Together.ai API key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setKeyStatus('idle');
                setKeyError(null);
              }}
            />
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!apiKey.trim() || keyStatus === 'testing'}
            >
              {keyStatus === 'testing' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : keyStatus === 'valid' ? (
                <Check className="size-4 text-green-500" />
              ) : keyStatus === 'invalid' ? (
                <X className="size-4 text-destructive" />
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {keyStatus === 'valid' && (
            <p className="text-sm text-green-500">Connected successfully</p>
          )}
          {keyError && <p className="text-sm text-destructive">{keyError}</p>}
        </div>

        {keyStatus === 'valid' && (
          <div className="space-y-2">
            <Label>Base model</Label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading models...
              </div>
            ) : modelsError ? (
              <p className="text-sm text-destructive">{modelsError}</p>
            ) : (
              <Select value={model} onValueChange={(value) => setModel(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <span>{m.display_name}</span>
                        {m.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={!hasChanges || saving || keyStatus !== 'valid'}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// TRAINING DEFAULTS
// =============================================================================

function TrainingDefaultsSection({
  project,
  projectId,
}: {
  project: ProjectSettings;
  projectId: string;
}) {
  const [config, setConfig] = useState(project.training_config);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateTrainingDefaults(projectId, config);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Training defaults updated');
    }
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(project.training_config);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Defaults</CardTitle>
        <CardDescription>Default hyperparameters for fine-tuning jobs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="epochs">Epochs</Label>
            <Input
              id="epochs"
              type="number"
              min={1}
              max={20}
              value={config.epochs}
              onChange={(e) =>
                setConfig({
                  ...config,
                  epochs: parseInt(e.target.value) || 3,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batchSize">Batch size</Label>
            <Input
              id="batchSize"
              type="number"
              min={1}
              max={32}
              value={config.batch_size}
              onChange={(e) =>
                setConfig({
                  ...config,
                  batch_size: parseInt(e.target.value) || 4,
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lr">Learning rate</Label>
          <Input
            id="lr"
            type="number"
            step={0.000001}
            min={0}
            value={config.learning_rate}
            onChange={(e) =>
              setConfig({
                ...config,
                learning_rate: parseFloat(e.target.value) || 0.00001,
              })
            }
          />
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-0">
              <ChevronDown
                className={`size-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
              Advanced LoRA settings
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loraR">LoRA r</Label>
                <Input
                  id="loraR"
                  type="number"
                  min={1}
                  value={config.lora_r}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      lora_r: parseInt(e.target.value) || 16,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loraAlpha">LoRA alpha</Label>
                <Input
                  id="loraAlpha"
                  type="number"
                  min={1}
                  value={config.lora_alpha}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      lora_alpha: parseInt(e.target.value) || 32,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loraDropout">Dropout</Label>
                <Input
                  id="loraDropout"
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={config.lora_dropout}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      lora_dropout: parseFloat(e.target.value) || 0.05,
                    })
                  }
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// TEAM MANAGEMENT
// =============================================================================

function TeamManagementSection({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'trainer' | 'rater'>('rater');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      setLoading(true);
      const result = await getTeamMembers(projectId);
      if (result.members) {
        setMembers(result.members);
      }
      setLoading(false);
    }
    loadMembers();
  }, [projectId]);

  async function reloadMembers() {
    setLoading(true);
    const result = await getTeamMembers(projectId);
    if (result.members) {
      setMembers(result.members);
    }
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    const result = await inviteTeamMember(projectId, inviteEmail.trim(), inviteRole);
    setInviting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      reloadMembers();
    }
  }

  async function handleRoleChange(userId: string, role: 'trainer' | 'rater') {
    const result = await updateMemberRole(projectId, userId, role);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Role updated');
      reloadMembers();
    }
  }

  async function handleRemove(userId: string, email: string) {
    const result = await removeMember(projectId, userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Removed ${email}`);
      reloadMembers();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Management</CardTitle>
        <CardDescription>Invite collaborators and manage their roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="teammate@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleInvite();
              }
            }}
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'trainer' | 'rater')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rater">Rater</SelectItem>
              <SelectItem value="trainer">Trainer</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
            {inviting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
          </Button>
        </div>

        <Separator />

        {loading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Loading team...</div>
        ) : members.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No team members yet. Invite collaborators above.
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{member.email}</span>
                  {member.role === 'owner' ? (
                    <Badge variant="default" className="text-xs">
                      Owner
                    </Badge>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        handleRoleChange(member.user_id, v as 'trainer' | 'rater')
                      }
                    >
                      <SelectTrigger className="h-7 w-24 border-0 bg-transparent text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rater">Rater</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {member.role !== 'owner' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {member.email} will lose access to this project. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(member.user_id, member.email)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// EXPORT
// =============================================================================

function ExportSection({ projectId }: { projectId: string }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const result = await exportDataset(projectId);
    setExporting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (!result.jsonl) {
      toast.error('No data to export');
      return;
    }

    // Create download
    const blob = new Blob([result.jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset-${new Date().toISOString().split('T')[0]}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Dataset exported');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Dataset</CardTitle>
        <CardDescription>Download all training examples as JSONL</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Download Dataset
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// DANGER ZONE
// =============================================================================

function DangerZoneSection({
  projectId,
  projectName,
  router,
}: {
  projectId: string;
  projectName: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (confirmText !== projectName) {
      toast.error('Project name does not match');
      return;
    }

    setDeleting(true);
    const result = await deleteProject(projectId);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.clearCookie) {
      document.cookie = 'active_project=; path=/; max-age=0';
    }

    toast.success('Project deleted');
    router.push('/setup');
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </div>
        <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Project</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all examples, training runs, and evaluations. This action cannot be
                undone.
                <br />
                <br />
                Type <strong>{projectName}</strong> to confirm:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="Type project name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={confirmText !== projectName || deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Delete Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
