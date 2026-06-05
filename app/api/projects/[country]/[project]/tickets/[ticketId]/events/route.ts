import { appendChangeLogs, visibleEntityId } from "@/lib/change-log";
import { scheduleAutoTicketAiPolish } from "@/lib/auto-ai-polish-queue";
import { scheduleAutoTicketNextAction } from "@/lib/auto-ticket-next-action-queue";
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
    const existingTicket = tickets[ticketIndex];
    const shouldMarkPendingInternal =
      event.role === "customer" && existingTicket.status !== "pending_internal";
    const ticket = {
      ...existingTicket,
      status: event.role === "customer" ? "pending_internal" : existingTicket.status,
      events: [...existingTicket.events, event].sort(sortEvents),
      updated_at: beijingNowIsoString(),
    };
    const nextTickets = tickets.toSpliced(ticketIndex, 1, ticket).sort(sortTickets);
    await writeTickets(key, nextTickets);
    await appendChangeLogs(key, [
      {
        entityType: "ticket",
        ...visibleEntityId(ticket),
        action: "ticket_event_added",
        content: event.content,
      },
      ...(shouldMarkPendingInternal
        ? [
            {
              entityType: "ticket" as const,
              ...visibleEntityId(ticket),
              action: "ticket_updated" as const,
              content:
                "Status changed to pending_internal because a customer event was added.",
            },
          ]
        : []),
    ]);
    const autoPolish = scheduleAutoTicketAiPolish(key, ticket.id);
    const autoNextAction = scheduleAutoTicketNextAction(key, ticket.id);
    return Response.json({ event, ticket, autoPolish, autoNextAction }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
