import { analyzeTicket } from "@/lib/ai-analysis";
import { listProjects, readTickets } from "@/lib/projects";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ projectId: string; ticketId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const { projectId, ticketId } = await context.params;
    const project = (await listProjects()).find(
      (item) => item.project.project_id === projectId,
    );
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const ticket = (await readTickets(project.folder)).find(
      (current) => current.id === ticketId,
    );
    if (!ticket) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    return Response.json({ analysis: await analyzeTicket(ticket) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
