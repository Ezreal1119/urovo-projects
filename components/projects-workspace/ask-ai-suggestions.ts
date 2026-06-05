import type { Ticket } from "@/lib/types";
import type { ProjectAskAiSuggestion } from "./types";

const generalSuggestions: ProjectAskAiSuggestion[] = [
  {
    id: "general-progress",
    label: "项目的最新进度是什么？",
    prompt: "项目的最新进度是什么？",
    kind: "general",
    meta: "Progress",
  },
  {
    id: "general-release-history",
    label: "出货的历史版本记录发我一下",
    prompt: "出货的历史版本记录发我一下",
    kind: "general",
    meta: "Release records",
  },
  {
    id: "general-open-tickets",
    label: "有什么未解决的 Tickets？",
    prompt: "有什么未解决的 Tickets？",
    kind: "general",
    meta: "Tickets",
  },
  {
    id: "general-open-requirements",
    label: "哪些需求还没有完成？",
    prompt: "哪些需求还没有完成？",
    kind: "general",
    meta: "Requirements",
  },
  {
    id: "general-risks-next-actions",
    label: "帮我总结一下接下来要做什么？",
    prompt: "帮我总结一下接下来要做什么？",
    kind: "general",
    meta: "Risks",
  },
  {
    id: "general-shipping-demands",
    label: "总结一下目前客户项目的出货需求",
    prompt: "总结一下目前客户项目的出货需求",
    kind: "general",
    meta: "Shipping demands",
  },
];

const ticketStatusRank: Record<Ticket["status"], number> = {
  pending_internal: 0,
  pending_customer: 1,
  resolved: 2,
};

export function buildProjectAskAiSuggestions(
  tickets: Ticket[],
): ProjectAskAiSuggestion[] {
  const ticketSuggestions = tickets
    .filter(
      (ticket) => ticket.priority === "urgent" && ticket.status !== "resolved",
    )
    .sort((left, right) => {
      const statusDifference =
        ticketStatusRank[left.status] - ticketStatusRank[right.status];
      if (statusDifference !== 0) {
        return statusDifference;
      }
      const leftTime = left.updated_at || left.created_at || "";
      const rightTime = right.updated_at || right.created_at || "";
      const timeDifference = rightTime.localeCompare(leftTime);
      if (timeDifference !== 0) {
        return timeDifference;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 3)
    .map<ProjectAskAiSuggestion>((ticket) => {
      const title = ticket.title.trim() || ticket.id;
      return {
        id: `ticket-${ticket.id}`,
        label: title,
        prompt: `请针对 Ticket「${title}」总结一下这个 Ticket 的情况，并且说明一下最新进展是什么，以及下一步要怎么做。`,
        kind: "ticket",
        tone: "urgent",
      };
    });

  return [...generalSuggestions, ...ticketSuggestions];
}
