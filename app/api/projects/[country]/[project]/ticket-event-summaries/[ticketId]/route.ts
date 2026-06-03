import {
  polishSingleTicketEventSummaries,
  TicketEventSummaryNotFoundError,
} from "@/lib/ticket-event-summaries";
import { cancelAutoTicketAiPolish } from "@/lib/auto-ai-polish-queue";
import { projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; ticketId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    cancelAutoTicketAiPolish(key, ticketId);
    return Response.json(await polishSingleTicketEventSummaries(key, ticketId));
  } catch (error) {
    if (error instanceof TicketEventSummaryNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
