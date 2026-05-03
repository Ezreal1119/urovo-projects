import {
  projectKeyFromSegments,
  readRequirements,
  readTickets,
  sortTickets,
  updateTicketPayload,
  writeTickets,
} from "@/lib/projects";
import { TicketInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string; ticketId: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as TicketInput;
    const tickets = await readTickets(key);
    const index = tickets.findIndex((ticket) => ticket.id === ticketId);
    if (index === -1) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    const updated = updateTicketPayload(tickets[index], input);
    const nextTickets = tickets.toSpliced(index, 1, updated).sort(sortTickets);
    await writeTickets(key, nextTickets);
    return Response.json({ ticket: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const tickets = await readTickets(key);
    const nextTickets = tickets.filter((ticket) => ticket.id !== ticketId);
    if (nextTickets.length === tickets.length) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    const linkedRequirements = (await readRequirements(key))
      .filter((requirement) => requirement.related_tickets.includes(ticketId))
      .map((requirement) => ({
        id: requirement.id,
        title: requirement.title,
      }));

    if (linkedRequirements.length > 0) {
      return Response.json(
        {
          code: "TICKET_LINKED_TO_REQUIREMENTS",
          error: "Ticket is linked to one or more requirements.",
          requirements: linkedRequirements,
        },
        { status: 409 },
      );
    }

    await writeTickets(key, nextTickets);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
