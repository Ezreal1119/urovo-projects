import {
  deleteReleaseRecord,
  ReleaseRecordNotFoundError,
  updateReleaseRecord,
} from "@/lib/release-records";
import { projectKeyFromSegments } from "@/lib/projects";
import type { ReleaseRecordInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; recordId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project, recordId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as ReleaseRecordInput;
    return Response.json({
      record: await updateReleaseRecord(key, recordId, input),
    });
  } catch (error) {
    if (error instanceof ReleaseRecordNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { country, project, recordId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    await deleteReleaseRecord(key, recordId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ReleaseRecordNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
