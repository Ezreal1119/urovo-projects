import {
  createEventPayload,
  projectKeyFromSegments,
  readTickets,
  sortEvents,
  sortTickets,
  writeTickets,
} from "@/lib/projects";
import { beijingNowIsoString } from "@/lib/time";
import { EventInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string; ticketId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as EventInput;
    const tickets = await readTickets(key);
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === ticketId);
    if (ticketIndex === -1) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    const event = createEventPayload(input);
    const ticket = {
      ...tickets[ticketIndex],
      events: [...tickets[ticketIndex].events, event].sort(sortEvents),
      updated_at: beijingNowIsoString(),
    };
    const nextTickets = tickets.toSpliced(ticketIndex, 1, ticket).sort(sortTickets);
    await writeTickets(key, nextTickets);
    return Response.json({ event, ticket }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
