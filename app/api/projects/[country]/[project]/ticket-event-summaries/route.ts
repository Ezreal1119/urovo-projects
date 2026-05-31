import {
  polishTicketEventSummaries,
  readTicketEventSummaries,
} from "@/lib/ticket-event-summaries";
import { projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json({
      summaries: await readTicketEventSummaries(key),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json(await polishTicketEventSummaries(key));
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
