import {
  projectKeyFromSegments,
  readOverview,
  updateOverviewPayload,
  writeOverview,
} from "@/lib/projects";
import { releaseModelsInUse } from "@/lib/release-records";
import { OverviewInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json({ overview: await readOverview(key) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as OverviewInput;
    const existing = await readOverview(key);
    if (input.models !== undefined) {
      const nextModels = Array.isArray(input.models)
        ? input.models
            .filter((model): model is string => typeof model === "string")
            .map((model) => model.trim())
            .filter(Boolean)
        : [];
      const removedModels = existing.models.filter(
        (model) => !nextModels.includes(model),
      );
      const usedModels = await releaseModelsInUse(key, removedModels);
      if (usedModels.length > 0) {
        return Response.json(
          {
            error: `${usedModels[0]} is used by release records and cannot be removed.`,
          },
          { status: 400 },
        );
      }
    }
    const overview = updateOverviewPayload(existing, input);
    await writeOverview(key, overview);
    return Response.json({ overview });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
