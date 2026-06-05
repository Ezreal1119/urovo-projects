import { readAutoTicketAiPolishJobs } from "@/lib/auto-ai-polish-queue";
import { readAutoTicketNextActionJobs } from "@/lib/auto-ticket-next-action-queue";
import { projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json({
      jobs: readAutoTicketAiPolishJobs(key, { consumeTerminal: true }),
      nextActionJobs: readAutoTicketNextActionJobs(key, { consumeTerminal: true }),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
