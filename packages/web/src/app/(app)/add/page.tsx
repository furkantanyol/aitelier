import { getUserProjects } from "./actions";
import { AddExamples } from "@/components/add-examples";

export default async function AddPage() {
  const { projects } = await getUserProjects();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Add Examples
        </h1>
        <p className="text-sm text-muted-foreground">
          Add training examples manually or import in bulk.
        </p>
      </div>
      <AddExamples projects={projects} />
    </div>
  );
}
