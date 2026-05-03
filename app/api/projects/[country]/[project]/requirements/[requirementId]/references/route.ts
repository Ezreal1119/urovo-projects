import { createReference, referencesWithStatus } from "@/lib/local-references";
import { projectKeyFromSegments, readRequirements, writeRequirements } from "@/lib/projects";
import { beijingNowIsoString } from "@/lib/time";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; requirementId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const { key, requirement } = await requirementReferenceContext(country, project, requirementId);
    return Response.json({
      references: await referencesWithStatus(
        key,
        requirement.references,
        projectFileApiPath(country, project),
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const { key, requirements, requirement, index } = await requirementReferenceContext(
      country,
      project,
      requirementId,
    );
    const input = (await request.json()) as { path?: string };
    const reference = await createReference(key, input.path || "");

    if (requirement.references.some((current) => current.path === reference.path)) {
      return Response.json({ error: "This file is already referenced." }, { status: 409 });
    }

    const updatedRequirement = {
      ...requirement,
      references: [...requirement.references, reference],
      last_updated: beijingNowIsoString(),
    };
    await writeRequirements(key, requirements.toSpliced(index, 1, updatedRequirement));
    return Response.json({
      references: await referencesWithStatus(
        key,
        updatedRequirement.references,
        projectFileApiPath(country, project),
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const { key, requirements, requirement, index } = await requirementReferenceContext(
      country,
      project,
      requirementId,
    );
    const input = (await request.json()) as { id?: string; path?: string };
    const nextReferences = requirement.references.filter((reference) =>
      input.id ? reference.id !== input.id : reference.path !== input.path,
    );

    if (nextReferences.length === requirement.references.length) {
      return Response.json({ error: "Reference not found." }, { status: 404 });
    }

    const updatedRequirement = {
      ...requirement,
      references: nextReferences,
      last_updated: beijingNowIsoString(),
    };
    await writeRequirements(key, requirements.toSpliced(index, 1, updatedRequirement));
    return Response.json({
      references: await referencesWithStatus(
        key,
        updatedRequirement.references,
        projectFileApiPath(country, project),
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

async function requirementReferenceContext(country: string, project: string, requirementId: string) {
  const key = projectKeyFromSegments([country, project]);
  const requirements = await readRequirements(key);
  const index = requirements.findIndex((requirement) => requirement.id === requirementId);
  if (index === -1) {
    throw new Error("Requirement not found.");
  }

  return { key, requirements, requirement: requirements[index], index };
}

function projectFileApiPath(country: string, project: string) {
  return `/api/projects/${encodeURIComponent(country)}/${encodeURIComponent(project)}/references/file`;
}
