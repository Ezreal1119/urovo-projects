import {
  projectKeyFromSegments,
  readTickets,
  sortEvents,
  sortTickets,
  updateEventPayload,
  writeTickets,
} from "@/lib/projects";
import { beijingNowIsoString } from "@/lib/time";
import { EventInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string; ticketId: string; eventIndex: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project, ticketId, eventIndex } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as EventInput;
    const tickets = await readTickets(key);
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === ticketId);
    if (ticketIndex === -1) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    const index = Number(eventIndex);
    const events = tickets[ticketIndex].events;
    if (!Number.isInteger(index) || index < 0 || index >= events.length) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }

    const event = updateEventPayload(events[index], input);
    const ticket = {
      ...tickets[ticketIndex],
      events: events.toSpliced(index, 1, event).sort(sortEvents),
      updated_at: beijingNowIsoString(),
    };
    const nextTickets = tickets.toSpliced(ticketIndex, 1, ticket).sort(sortTickets);
    await writeTickets(key, nextTickets);
    return Response.json({ event, ticket });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { country, project, ticketId, eventIndex } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const tickets = await readTickets(key);
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === ticketId);
    if (ticketIndex === -1) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    const index = Number(eventIndex);
    const events = tickets[ticketIndex].events;
    if (!Number.isInteger(index) || index < 0 || index >= events.length) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }

    const ticket = {
      ...tickets[ticketIndex],
      events: events.toSpliced(index, 1),
      updated_at: beijingNowIsoString(),
    };
    const nextTickets = tickets.toSpliced(ticketIndex, 1, ticket).sort(sortTickets);
    await writeTickets(key, nextTickets);
    return Response.json({ ticket });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
