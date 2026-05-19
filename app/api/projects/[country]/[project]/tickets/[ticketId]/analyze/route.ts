import { analyzeTicket } from "@/lib/ai-analysis";
import { projectKeyFromSegments, readTickets } from "@/lib/projects";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; ticketId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const ticket = (await readTickets(key)).find(
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
