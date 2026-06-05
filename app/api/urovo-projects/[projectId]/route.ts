import { listProjects, readTickets } from "@/lib/projects";
import { readTicketEventSummaries } from "@/lib/ticket-event-summaries";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const project = (await listProjects()).find(
      (item) => item.project.project_id === projectId,
    );
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const [tickets, ticketEventSummaries] = await Promise.all([
      readTickets(project.folder),
      readTicketEventSummaries(project.folder),
    ]);

    return Response.json({ tickets, ticketEventSummaries });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
