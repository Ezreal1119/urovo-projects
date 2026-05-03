import { createReference, referencesWithStatus } from "@/lib/local-references";
import { projectKeyFromSegments, readTickets, writeTickets } from "@/lib/projects";
import { beijingNowIsoString } from "@/lib/time";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; ticketId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const { key, ticket } = await ticketReferenceContext(country, project, ticketId);
    return Response.json({
      references: await referencesWithStatus(
        key,
        ticket.references,
        projectFileApiPath(country, project),
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const { key, tickets, ticket, index } = await ticketReferenceContext(country, project, ticketId);
    const input = (await request.json()) as { path?: string };
    const reference = await createReference(key, input.path || "");

    if (ticket.references.some((current) => current.path === reference.path)) {
      return Response.json({ error: "This file is already referenced." }, { status: 409 });
    }

    const updatedTicket = {
      ...ticket,
      references: [...ticket.references, reference],
      updated_at: beijingNowIsoString(),
    };
    await writeTickets(key, tickets.toSpliced(index, 1, updatedTicket));
    return Response.json({
      references: await referencesWithStatus(
        key,
        updatedTicket.references,
        projectFileApiPath(country, project),
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const { key, tickets, ticket, index } = await ticketReferenceContext(country, project, ticketId);
    const input = (await request.json()) as { id?: string; path?: string };
    const nextReferences = ticket.references.filter((reference) =>
      input.id ? reference.id !== input.id : reference.path !== input.path,
    );

    if (nextReferences.length === ticket.references.length) {
      return Response.json({ error: "Reference not found." }, { status: 404 });
    }

    const updatedTicket = {
      ...ticket,
      references: nextReferences,
      updated_at: beijingNowIsoString(),
    };
    await writeTickets(key, tickets.toSpliced(index, 1, updatedTicket));
    return Response.json({
      references: await referencesWithStatus(
        key,
        updatedTicket.references,
        projectFileApiPath(country, project),
      ),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

async function ticketReferenceContext(country: string, project: string, ticketId: string) {
  const key = projectKeyFromSegments([country, project]);
  const tickets = await readTickets(key);
  const index = tickets.findIndex((ticket) => ticket.id === ticketId);
  if (index === -1) {
    throw new Error("Ticket not found.");
  }

  return { key, tickets, ticket: tickets[index], index };
}

function projectFileApiPath(country: string, project: string) {
  return `/api/projects/${encodeURIComponent(country)}/${encodeURIComponent(project)}/references/file`;
}
