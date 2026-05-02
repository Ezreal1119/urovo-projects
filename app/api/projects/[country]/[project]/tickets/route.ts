import {
  createTicketPayload,
  projectKeyFromSegments,
  readProject,
  readTickets,
  sortTickets,
  writeTickets,
} from "@/lib/projects";
import { TicketInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json({
      project: await readProject(key),
      tickets: await readTickets(key),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as TicketInput;
    const projectInfo = await readProject(key);
    const tickets = await readTickets(key);
    const ticket = createTicketPayload(input, tickets, projectInfo.project_name);
    const nextTickets = [ticket, ...tickets].sort(sortTickets);
    await writeTickets(key, nextTickets);
    return Response.json({ ticket }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
