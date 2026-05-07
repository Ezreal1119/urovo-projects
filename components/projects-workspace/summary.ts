import type { Overview, ProjectInfo, Requirement, RequirementTimelineItem, Ticket, TicketPriority, TimelineEvent } from "@/lib/types";
import { GENERAL_OVERVIEW_PRODUCT } from "@/lib/types";
import { APP_TIME_ZONE } from "@/lib/time";
import { eventRoleLabels, priorityLabels, requirementStatusLabels, statusLabels } from "./labels";
import { formatDateOnly } from "./formatters";

export function buildProjectSummary(
  project: ProjectInfo,
  overview: Overview,
  requirements: Requirement[],
  tickets: Ticket[],
) {
  const sections: string[] = [];
  const projectLines = [`# Project: ${project.project_name}`];
  const relateds = [...overview.models, ...overview.others];

  if (relateds.length > 0) {
    projectLines.push("", `- **Relateds**: ${relateds.join(", ")}`);
  }
  if (overview.description) {
    if (relateds.length === 0) {
      projectLines.push("");
    }
    projectLines.push(`- **Description**: ${overview.description}`);
  }
  sections.push(projectLines.join("\n"));

  if (overview.requirements.length > 0) {
    const requirementMap = new Map(
      requirements.map((requirement) => [requirement.id, requirement]),
    );
    const demandLines = ["## Demands"];

    for (const demand of sortOverviewDemandsForSummary(overview.requirements)) {
      demandLines.push("", `### ${demand.product}:`, "");
      for (const simpleRequirement of demand.simple_requirements) {
        demandLines.push(`- ${simpleRequirement}`);
      }
      for (const requirementId of demand.linked_requirements) {
        const linkedRequirement = requirementMap.get(requirementId);
        if (!linkedRequirement) {
          continue;
        }
        demandLines.push(`- ${stripBracketMetadata(linkedRequirement.title)}`);
      }
      if (demand.remark) {
        demandLines.push(`- Remark: ${demand.remark}`);
      }
    }

    sections.push(demandLines.join("\n"));
  }

  const activeRequirements = requirements.filter(
    (requirement) => requirement.status !== "finished",
  );
  if (activeRequirements.length > 0) {
    const requirementLines = ["## Requirements"];

    activeRequirements.forEach((requirement, index) => {
      if (index > 0) {
        requirementLines.push("", "---");
      }
      requirementLines.push(
        "",
        `### ${index + 1}. ${stripBracketMetadata(requirement.title)}:`,
        `  - **Status**: "${requirementStatusLabels[requirement.status]}"`,
      );
      const latestTimelineItem = latestRequirementTimelineItem(
        requirement.timeline,
      );
      if (latestTimelineItem) {
        requirementLines.push(
          "",
          "```",
          `Latest progress - Time: ${formatDateOnly(latestTimelineItem.time)}`,
          "",
          "<-----Content Below----->",
          "",
          latestTimelineItem.remark,
          "```",
        );
      }
    });

    sections.push(requirementLines.join("\n"));
  }

  const activeTickets = tickets
    .filter((ticket) => ticket.status !== "resolved")
    .map((ticket, index) => ({ ticket, index }))
    .sort((left, right) => {
      const priorityDifference =
        ticketSummaryPriorityRank[right.ticket.priority] -
        ticketSummaryPriorityRank[left.ticket.priority];
      return priorityDifference || left.index - right.index;
    })
    .map(({ ticket }) => ticket);
  if (activeTickets.length > 0) {
    const ticketLines = ["## Tickets"];

    activeTickets.forEach((ticket, index) => {
      if (index > 0) {
        ticketLines.push("", "---");
      }
      ticketLines.push(
        "",
        `### ${index + 1}. ${stripBracketMetadata(ticket.title)}:`,
        `  - **Status**: "${statusLabels[ticket.status]}"`,
        `  - **Priority**: "${priorityLabels[ticket.priority]}"`,
      );
      const latestEvent = latestTicketEvent(ticket.events);
      if (latestEvent) {
        ticketLines.push(
          "",
          "```",
          `Latest progress (${eventRoleLabels[latestEvent.role]}) - Time: ${formatDateOnly(
            latestEvent.time,
          )}`,
          "",
          "<-----Content Below----->",
          "",
          latestEvent.content,
          "```",
        );
      }
    });

    sections.push(ticketLines.join("\n"));
  }

  return `${sections.join("\n\n---\n\n")}\n`;
}

export function stripBracketMetadata(title: string) {
  const stripped = title.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  return stripped || "Untitled";
}

export function sortOverviewDemandsForSummary(demands: Overview["requirements"]) {
  return [...demands].sort((left, right) => {
    const leftIsGeneral = left.product === GENERAL_OVERVIEW_PRODUCT;
    const rightIsGeneral = right.product === GENERAL_OVERVIEW_PRODUCT;
    if (leftIsGeneral !== rightIsGeneral) {
      return leftIsGeneral ? -1 : 1;
    }
    return 0;
  });
}

export const ticketSummaryPriorityRank: Record<TicketPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export function latestTicketEvent(events: TimelineEvent[]) {
  return events.reduce<TimelineEvent | null>((latest, event) => {
    if (!latest || event.time.localeCompare(latest.time) > 0) {
      return event;
    }
    return latest;
  }, null);
}

export function latestRequirementTimelineItem(
  timeline: RequirementTimelineItem[],
) {
  return timeline.reduce<RequirementTimelineItem | null>((latest, item) => {
    if (!latest || item.time.localeCompare(latest.time) > 0) {
      return item;
    }
    return latest;
  }, null);
}

export async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyTextWithTextarea(text);
  }
}

export function downloadSummaryMarkdownAsPng(markdown: string, filename: string) {
  try {
    const layout = layoutSummaryMarkdown(markdown);
    if (layout.height <= 0) {
      return false;
    }
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = layout.width * scale;
    canvas.height = layout.height * scale;
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, layout.width, layout.height);
    drawSummaryMarkdownLayout(context, layout);

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}

export function projectSummaryPngFilename(projectName: string, now = new Date()) {
  const safeProjectName =
    sanitizeFilenamePart(projectName).replace(/\s+/g, " ").trim() || "Project";
  return `${safeProjectName} (${formatFilenameDateTime(now)}).png`;
}

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFilenameDateTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day} ${values.hour}-${values.minute}-${values.second}`;
}

export type SummaryDrawSegment = {
  text: string;
  bold: boolean;
};

export type SummaryDrawLine = {
  type: "text" | "code" | "rule";
  x: number;
  y: number;
  maxWidth: number;
  font: string;
  color: string;
  segments?: SummaryDrawSegment[];
};

export type SummaryCodeBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SummaryCanvasLayout = {
  width: number;
  height: number;
  padding: number;
  lines: SummaryDrawLine[];
  codeBlocks: SummaryCodeBlock[];
};

export function layoutSummaryMarkdown(markdown: string): SummaryCanvasLayout {
  const width = 960;
  const padding = 48;
  const contentWidth = width - padding * 2;
  const lines = markdown.trimEnd().split("\n");
  const drawLines: SummaryDrawLine[] = [];
  const codeBlocks: SummaryCodeBlock[] = [];
  let y = padding;

  function addWrappedMarkdownLine(
    text: string,
    x: number,
    maxWidth: number,
    font: string,
    color: string,
    lineHeight: number,
  ) {
    const wrappedLines = wrapMarkdownInlineSegments(text, maxWidth, font);
    for (const segments of wrappedLines) {
      drawLines.push({
        type: "text",
        x,
        y,
        maxWidth,
        font,
        color,
        segments,
      });
      y += lineHeight;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line === "```") {
      const codeLines = [];
      index += 1;
      while (index < lines.length && lines[index] !== "```") {
        codeLines.push(lines[index]);
        index += 1;
      }
      y += 10;
      const blockX = padding;
      const blockY = y;
      const blockPadding = 20;
      const lineHeight = 25;
      const codeFont =
        '15px "SFMono-Regular", Consolas, "Liberation Mono", monospace';
      y += blockPadding;
      for (const codeLine of codeLines) {
        const wrappedCodeLines = wrapPlainText(
          codeLine || " ",
          contentWidth - blockPadding * 2,
          codeFont,
        );
        for (const wrappedCodeLine of wrappedCodeLines) {
          drawLines.push({
            type: "code",
            x: blockX + blockPadding,
            y,
            maxWidth: contentWidth - blockPadding * 2,
            font: codeFont,
            color: "#f8fafc",
            segments: [{ text: wrappedCodeLine, bold: false }],
          });
          y += lineHeight;
        }
      }
      y += blockPadding - 4;
      codeBlocks.push({
        x: blockX,
        y: blockY,
        width: contentWidth,
        height: y - blockY,
      });
      y += 14;
      continue;
    }

    if (!line.trim()) {
      y += 10;
      continue;
    }

    if (line === "---") {
      y += 18;
      drawLines.push({
        type: "rule",
        x: padding,
        y,
        maxWidth: contentWidth,
        font: "",
        color: "#cbd5e1",
      });
      y += 28;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const font =
        level === 1
          ? '750 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          : level === 2
            ? '750 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            : '750 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const lineHeight = level === 1 ? 44 : level === 2 ? 36 : 30;
      addWrappedMarkdownLine(heading[2], padding, contentWidth, font, "#020617", lineHeight);
      y += level === 1 ? 10 : 6;
      continue;
    }

    const bullet = line.match(/^(\s*)-\s+(.+)$/);
    if (bullet) {
      const nested = bullet[1].length > 0;
      const bulletX = nested ? padding + 28 : padding;
      const textX = bulletX + 22;
      const lineHeight = 29;
      drawLines.push({
        type: "text",
        x: bulletX,
        y,
        maxWidth: 10,
        font: '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#64748b",
        segments: [{ text: "•", bold: false }],
      });
      addWrappedMarkdownLine(
        bullet[2],
        textX,
        width - padding - textX,
        '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        "#1e293b",
        lineHeight,
      );
      continue;
    }

    addWrappedMarkdownLine(
      line,
      padding,
      contentWidth,
      '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      "#1e293b",
      29,
    );
  }

  return {
    width,
    height: Math.ceil(y + padding),
    padding,
    lines: drawLines,
    codeBlocks,
  };
}

export function drawSummaryMarkdownLayout(
  context: CanvasRenderingContext2D,
  layout: SummaryCanvasLayout,
) {
  for (const block of layout.codeBlocks) {
    context.fillStyle = "#0f172a";
    drawRoundedRect(context, block.x, block.y, block.width, block.height, 8);
    context.fill();
  }

  for (const line of layout.lines) {
    if (line.type === "rule") {
      context.strokeStyle = line.color;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(line.x, line.y);
      context.lineTo(line.x + line.maxWidth, line.y);
      context.stroke();
      continue;
    }

    context.textBaseline = "top";
    context.fillStyle = line.color;
    context.font = line.font;
    let x = line.x;
    for (const segment of line.segments ?? []) {
      context.font = segment.bold
        ? line.font.replace(/^(\d)/, "700 $1")
        : line.font;
      context.fillText(segment.text, x, line.y);
      x += context.measureText(segment.text).width;
    }
  }
}

export function wrapMarkdownInlineSegments(
  text: string,
  maxWidth: number,
  font: string,
) {
  const segments = parseMarkdownInlineSegments(text);
  const rows: SummaryDrawSegment[][] = [];
  let currentRow: SummaryDrawSegment[] = [];
  let currentWidth = 0;

  for (const segment of segments) {
    const tokens = segment.text.split(/(\s+)/).filter(Boolean);
    for (const token of tokens) {
      const tokenWidth = measureCanvasText(token, font, segment.bold);
      if (currentRow.length > 0 && currentWidth + tokenWidth > maxWidth) {
        rows.push(trimDrawSegments(currentRow));
        currentRow = [];
        currentWidth = 0;
      }
      currentRow.push({ text: token, bold: segment.bold });
      currentWidth += tokenWidth;
    }
  }

  if (currentRow.length > 0) {
    rows.push(trimDrawSegments(currentRow));
  }

  return rows.length > 0 ? rows : [[{ text, bold: false }]];
}

export function parseMarkdownInlineSegments(text: string): SummaryDrawSegment[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { text: part.slice(2, -2), bold: true };
    }
    return { text: part, bold: false };
  });
}

export function wrapPlainText(text: string, maxWidth: number, font: string) {
  const rows: string[] = [];
  for (const sourceLine of text.split("\n")) {
    const tokens = sourceLine.split(/(\s+)/).filter(Boolean);
    let row = "";
    for (const token of tokens) {
      const next = `${row}${token}`;
      if (row && measureCanvasText(next, font, false) > maxWidth) {
        rows.push(row.trimEnd());
        row = token.trimStart();
      } else {
        row = next;
      }
    }
    rows.push(row || " ");
  }
  return rows;
}

export function trimDrawSegments(segments: SummaryDrawSegment[]) {
  const next = [...segments];
  while (next[0]?.text.trim() === "") {
    next.shift();
  }
  while (next.at(-1)?.text.trim() === "") {
    next.pop();
  }
  return next;
}

export function measureCanvasText(text: string, font: string, bold: boolean) {
  const canvas = measureCanvasText.canvas ?? document.createElement("canvas");
  measureCanvasText.canvas = canvas;
  const context = canvas.getContext("2d");
  if (!context) {
    return text.length * 10;
  }
  context.font = bold ? font.replace(/^(\d)/, "700 $1") : font;
  return context.measureText(text).width;
}
measureCanvasText.canvas = null as HTMLCanvasElement | null;

export function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function copyTextWithTextarea(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
