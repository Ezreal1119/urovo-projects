import { analyzeRequirement } from "@/lib/ai-analysis";
import { projectKeyFromSegments, readRequirements } from "@/lib/projects";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; requirementId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const requirement = (await readRequirements(key)).find(
      (current) => current.id === requirementId,
    );

    if (!requirement) {
      return Response.json(
        { error: "Requirement not found." },
        { status: 404 },
      );
    }

    return Response.json({ analysis: await analyzeRequirement(requirement) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
