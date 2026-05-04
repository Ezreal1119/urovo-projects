import { cloudinaryAssetPrefix, deleteAssetsByPrefix } from "@/lib/cloudinary-assets";
import { appendChangeLogs, visibleEntityId } from "@/lib/change-log";
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
    await appendChangeLogs(key, [
      {
        entityType: "ticket",
        ...visibleEntityId(updated),
        action: "ticket_updated",
        content: ticketContent(updated),
      },
    ]);
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
    const ticket = tickets.find((current) => current.id === ticketId);
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

    await deleteAssetsByPrefix(
      cloudinaryAssetPrefix(country, project, "tickets", ticket?.uuid || ticketId),
    );
    await writeTickets(key, nextTickets);
    if (ticket) {
      await appendChangeLogs(key, [
        {
          entityType: "ticket",
          ...visibleEntityId(ticket),
          action: "ticket_deleted",
          content: `Deleted ticket [${ticket.id}]: ${ticket.title}`,
        },
      ]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

function ticketContent(ticket: { title: string; summary: string; next_action: string }) {
  return [ticket.title, ticket.summary, ticket.next_action].filter(Boolean).join(" ");
}
