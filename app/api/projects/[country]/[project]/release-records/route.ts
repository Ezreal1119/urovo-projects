import {
  createReleaseRecord,
  readReleaseRecordsForModel,
} from "@/lib/release-records";
import { projectKeyFromSegments } from "@/lib/projects";
import type { ReleaseRecordInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const { searchParams } = new URL(request.url);
    return Response.json({
      records: await readReleaseRecordsForModel(
        key,
        searchParams.get("model") || "",
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as ReleaseRecordInput;
    return Response.json(
      { record: await createReleaseRecord(key, input) },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
