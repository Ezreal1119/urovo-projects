import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { AiAnalysisResult, ProjectAskAiMessage, ProjectJsonDraft, ReportGenerateDraft, ReportGenerateResponse, RequirementDeleteBlocker, TicketDeleteBlocker } from "../types";
import { emptyProjectJsonDraft, projectJsonDraftsEqual } from "../drafts";
import { copyTextToClipboard, downloadSummaryMarkdownAsPng, projectSummaryPngFilename } from "../summary";
import { todayDate } from "../formatters";
import { Field, Overlay } from "../ui";

export function AiAnalysisDialog({
  analysis,
  loading,
  error,
  hasUnsavedChanges,
  onClose,
}: {
  analysis: AiAnalysisResult | null;
  loading: boolean;
  error: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadBlocked, setDownloadBlocked] = useState(false);

  async function copyAnalysis() {
    if (!analysis) {
      return;
    }
    setCopyBlocked(false);
    setDownloaded(false);
    setDownloadBlocked(false);
    const didCopy = await copyTextToClipboard(analysis.markdown);
    if (!didCopy) {
      setCopyBlocked(true);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function downloadAnalysisPng() {
    if (!analysis) {
      return;
    }
    setCopied(false);
    setCopyBlocked(false);
    setDownloadBlocked(false);
    const didDownload = downloadSummaryMarkdownAsPng(
      analysis.markdown,
      projectSummaryPngFilename(`${analysis.entityId}-ai-analysis`),
    );
    if (!didDownload) {
      setDownloadBlocked(true);
      return;
    }
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1800);
  }

  return (
    <Overlay>
      <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">
              AI Analysis
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {analysis
                ? `[${analysis.entityId}] ${analysis.title}`
                : "Analyzing saved record"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {hasUnsavedChanges ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Analysis uses the last saved record. Unsaved edits are not included.
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-600">
            Analyzing with AI...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : analysis ? (
          <>
            <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
              <AnalysisSection title="Description" text={analysis.description} />
              <AnalysisSection title="Progress" text={analysis.progress} />
              <div className="grid gap-4 sm:grid-cols-2">
                <AnalysisSection
                  title="Current Status"
                  text={analysis.currentStatus}
                />
                <AnalysisSection title="Next Step" text={analysis.nextStep} />
              </div>
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Timeline
                </h3>
                {analysis.events.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {analysis.events.map((event, index) => (
                      <div
                        key={`${event.time}-${index}`}
                        className="grid gap-1 border-l-2 border-slate-200 pl-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
                      >
                        <div className="text-xs font-medium text-slate-500">
                          {event.time}
                        </div>
                        <div className="text-sm leading-6 text-slate-700">
                          {event.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    No timeline events are recorded.
                  </p>
                )}
              </section>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div
                className={`min-h-5 text-sm font-medium transition ${
                  copied || downloaded
                    ? "text-emerald-700"
                    : copyBlocked || downloadBlocked
                      ? "text-amber-700"
                      : "text-slate-400"
                }`}
                aria-live="polite"
              >
                {copied
                  ? "Copied Markdown."
                  : downloaded
                    ? "PNG downloaded."
                    : copyBlocked
                      ? "Clipboard access blocked."
                      : downloadBlocked
                        ? "PNG download failed."
                        : " "}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyAnalysis()}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition ${
                    copied
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {copied ? "Copied" : "Copy Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadAnalysisPng()}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition ${
                    downloaded
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {downloaded ? "Downloaded" : "Download PNG"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Overlay>
  );
}

function AnalysisSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {text || "-"}
      </p>
    </section>
  );
}

export function ProjectAskAiDialog({
  projectName,
  messages,
  loading,
  error,
  onClose,
  onAsk,
}: {
  projectName: string;
  messages: ProjectAskAiMessage[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onAsk: (prompt: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [emptyError, setEmptyError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copyBlockedIndex, setCopyBlockedIndex] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || loading) {
      setEmptyError("Enter a question first.");
      return;
    }
    setEmptyError("");
    setCopiedIndex(null);
    setCopyBlockedIndex(null);
    await onAsk(prompt);
    setDraft("");
  }

  async function copyAnswer(message: ProjectAskAiMessage, index: number) {
    setCopiedIndex(null);
    setCopyBlockedIndex(null);
    const didCopy = await copyTextToClipboard(message.content);
    if (!didCopy) {
      setCopyBlockedIndex(index);
      return;
    }
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1800);
  }

  return (
    <Overlay>
      <div className="flex h-[min(92vh,54rem)] w-[min(96vw,72rem)] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-slate-950/20 ring-1 ring-cyan-100">
        <div className="border-b border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_48%,#ecfdf5_100%)] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Ask AI
              </h2>
              <p className="mt-1 max-w-3xl truncate text-sm font-medium text-slate-500">
                {projectName || "Project workspace"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef8f6_100%)] px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="grid min-h-full place-items-center">
              <div className="w-full max-w-xl rounded-2xl border border-dashed border-cyan-200 bg-white/80 p-8 text-center shadow-lg shadow-slate-200/50 ring-1 ring-white">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-cyan-100 shadow-md shadow-cyan-200">
                  AI
                </div>
                <h3 className="text-base font-semibold text-slate-950">
                  Start a project conversation
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ask about demands, requirements, tickets, release records, or
                  current project progress.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message, index) => {
                const isAssistant = message.role === "assistant";
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${
                      isAssistant ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[min(92%,48rem)] overflow-hidden rounded-2xl border shadow-lg ring-1 ${
                        isAssistant
                          ? "border-white bg-white text-slate-700 shadow-slate-200/70 ring-slate-900/[0.04]"
                          : "border-cyan-200 bg-cyan-50/90 text-slate-800 shadow-cyan-100/70 ring-cyan-100"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
                          isAssistant
                            ? "border-slate-100 bg-slate-50/80"
                            : "border-cyan-100 bg-white/50"
                        }`}
                      >
                        <span
                          className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
                            isAssistant ? "text-cyan-700" : "text-slate-500"
                          }`}
                        >
                          {isAssistant ? "AI Answer" : "You"}
                        </span>
                        {isAssistant ? (
                          <button
                            type="button"
                            onClick={() => void copyAnswer(message, index)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                              copiedIndex === index
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-cyan-200 hover:bg-cyan-50 hover:text-slate-950"
                            }`}
                            aria-label="Copy AI answer"
                          >
                            {copiedIndex === index ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                      <div className="px-4 py-4">
                        {isAssistant ? (
                          <MarkdownContent markdown={message.content} />
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
                            {message.content}
                          </div>
                        )}
                        {copyBlockedIndex === index ? (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                            Clipboard access blocked.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {loading ? (
            <div className="mt-5 flex justify-start">
              <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm font-semibold text-cyan-700 shadow-lg shadow-slate-200/60">
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
                AI is answering...
              </div>
            </div>
          ) : null}
        </div>

        <form
          className="border-t border-slate-200 bg-white/95 px-4 py-4 sm:px-6"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner shadow-slate-200/60">
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setEmptyError("");
              }}
              disabled={loading}
              className="min-h-24 w-full resize-none rounded-xl border border-transparent bg-white px-4 py-3 text-sm leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Ask about this project"
            />
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-sm font-medium" aria-live="polite">
              {emptyError ? (
                <span className="text-amber-700">{emptyError}</span>
              ) : error ? (
                <span className="text-red-700">{error}</span>
              ) : (
                <span className="text-slate-400"> </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !draft.trim()}
              className="rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-300 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

type MarkdownBlock =
  | { type: "heading"; key: string; level: number; text: string }
  | { type: "paragraph"; key: string; text: string }
  | { type: "list"; key: string; ordered: boolean; items: string[] }
  | { type: "code"; key: string; code: string };

function MarkdownContent({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownBlocks(markdown);
  if (blocks.length === 0) {
    return <div className="text-sm text-slate-500">-</div>;
  }

  return (
    <div className="space-y-4 text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
      {blocks.map((block) => renderMarkdownBlock(block))}
    </div>
  );
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        key: `code-${blocks.length}`,
        code: codeLines.join("\n"),
      });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        key: `heading-${blocks.length}`,
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    const listKind = listLineKind(trimmed);
    if (listKind) {
      const items: string[] = [];
      const ordered = listKind === "ordered";
      while (index < lines.length) {
        const current = lines[index]?.trim() ?? "";
        if (listLineKind(current) !== listKind) {
          break;
        }
        items.push(current.replace(ordered ? /^\d+[.)]\s+/ : /^[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push({
        type: "list",
        key: `list-${blocks.length}`,
        ordered,
        items,
      });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      const currentTrimmed = current.trim();
      if (
        !currentTrimmed ||
        currentTrimmed.startsWith("```") ||
        currentTrimmed.match(/^(#{1,6})\s+(.+)$/) ||
        listLineKind(currentTrimmed)
      ) {
        break;
      }
      paragraphLines.push(currentTrimmed);
      index += 1;
    }
    blocks.push({
      type: "paragraph",
      key: `paragraph-${blocks.length}`,
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function renderMarkdownBlock(block: MarkdownBlock) {
  if (block.type === "heading") {
    const headingClass =
      block.level <= 2
        ? "text-base font-semibold text-slate-950"
        : "text-sm font-semibold text-slate-900";
    return (
      <div key={block.key} className={headingClass}>
        {renderInlineMarkdown(block.text, block.key)}
      </div>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        key={block.key}
        className={`space-y-1 pl-5 ${
          block.ordered ? "list-decimal" : "list-disc"
        }`}
      >
        {block.items.map((item, index) => (
          <li key={`${block.key}-${index}`}>
            {renderInlineMarkdown(item, `${block.key}-${index}`)}
          </li>
        ))}
      </ListTag>
    );
  }

  if (block.type === "code") {
    return (
      <pre
        key={block.key}
        className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-5 text-slate-100 shadow-inner"
      >
        <code>{block.code || " "}</code>
      </pre>
    );
  }

  return (
    <p key={block.key}>{renderInlineMarkdown(block.text, block.key)}</p>
  );
}

function listLineKind(line: string) {
  if (/^[-*+]\s+/.test(line)) {
    return "unordered";
  }
  if (/^\d+[.)]\s+/.test(line)) {
    return "ordered";
  }
  return "";
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let keyIndex = 0;

  while (index < text.length) {
    const token = findNextInlineToken(text, index, `${keyPrefix}-${keyIndex}`);
    if (!token) {
      nodes.push(text.slice(index));
      break;
    }
    if (token.start > index) {
      nodes.push(text.slice(index, token.start));
    }
    nodes.push(token.node);
    index = token.end;
    keyIndex += 1;
  }

  return nodes;
}

function findNextInlineToken(text: string, start: number, key: string) {
  const candidates = [
    findInlineCodeToken(text, start, key),
    findLinkToken(text, start, key),
    findStrongToken(text, start, key),
    findEmphasisToken(text, start, key),
  ].filter((token): token is InlineToken => Boolean(token));

  return candidates.sort((left, right) => left.start - right.start)[0] ?? null;
}

type InlineToken = {
  start: number;
  end: number;
  node: ReactNode;
};

function findInlineCodeToken(
  text: string,
  start: number,
  key: string,
): InlineToken | null {
  const tokenStart = text.indexOf("`", start);
  if (tokenStart === -1) {
    return null;
  }
  const tokenEnd = text.indexOf("`", tokenStart + 1);
  if (tokenEnd === -1) {
    return null;
  }
  return {
    start: tokenStart,
    end: tokenEnd + 1,
    node: (
      <code
        key={key}
        className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[0.85em] font-semibold text-slate-900"
      >
        {text.slice(tokenStart + 1, tokenEnd)}
      </code>
    ),
  };
}

function findLinkToken(
  text: string,
  start: number,
  key: string,
): InlineToken | null {
  const linkStart = text.indexOf("[", start);
  if (linkStart === -1) {
    return null;
  }
  const labelEnd = text.indexOf("](", linkStart + 1);
  if (labelEnd === -1) {
    return null;
  }
  const hrefEnd = text.indexOf(")", labelEnd + 2);
  if (hrefEnd === -1) {
    return null;
  }

  const label = text.slice(linkStart + 1, labelEnd);
  const href = safeMarkdownHref(text.slice(labelEnd + 2, hrefEnd));
  if (!href) {
    return {
      start: linkStart,
      end: hrefEnd + 1,
      node: <span key={key}>{label}</span>,
    };
  }

  return {
    start: linkStart,
    end: hrefEnd + 1,
    node: (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-2 hover:text-cyan-900"
      >
        {renderInlineMarkdown(label, `${key}-label`)}
      </a>
    ),
  };
}

function findStrongToken(
  text: string,
  start: number,
  key: string,
): InlineToken | null {
  const tokenStart = text.indexOf("**", start);
  if (tokenStart === -1) {
    return null;
  }
  const tokenEnd = text.indexOf("**", tokenStart + 2);
  if (tokenEnd === -1) {
    return null;
  }
  return {
    start: tokenStart,
    end: tokenEnd + 2,
    node: (
      <strong key={key} className="font-semibold text-slate-950">
        {renderInlineMarkdown(text.slice(tokenStart + 2, tokenEnd), key)}
      </strong>
    ),
  };
}

function findEmphasisToken(
  text: string,
  start: number,
  key: string,
): InlineToken | null {
  let tokenStart = text.indexOf("*", start);
  while (tokenStart !== -1) {
    if (text[tokenStart - 1] === "*" || text[tokenStart + 1] === "*") {
      tokenStart = text.indexOf("*", tokenStart + 1);
      continue;
    }
    let tokenEnd = text.indexOf("*", tokenStart + 1);
    while (tokenEnd !== -1) {
      if (text[tokenEnd - 1] !== "*" && text[tokenEnd + 1] !== "*") {
        return {
          start: tokenStart,
          end: tokenEnd + 1,
          node: (
            <em key={key} className="text-slate-800">
              {renderInlineMarkdown(text.slice(tokenStart + 1, tokenEnd), key)}
            </em>
          ),
        };
      }
      tokenEnd = text.indexOf("*", tokenEnd + 1);
    }
    tokenStart = text.indexOf("*", tokenStart + 1);
  }

  return null;
}

function safeMarkdownHref(value: string) {
  const href = value.trim();
  return /^(https?:|mailto:)/i.test(href) ? href : "";
}

export function TicketDeleteBlockedDialog({
  blocker,
  onClose,
  onOpenRequirement,
}: {
  blocker: TicketDeleteBlocker;
  onClose: () => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Ticket cannot be deleted
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              [{blocker.ticketId}] is linked to the requirement records below.
              Remove the related ticket link from each requirement first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {blocker.requirements.map((requirement) => (
            <button
              key={requirement.id}
              type="button"
              onClick={() => onOpenRequirement(requirement.id)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-sm font-semibold text-slate-950">
                [{requirement.id}]:{" "}
                {requirement.title || "Untitled requirement"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Open requirement detail
              </div>
            </button>
          ))}
          {blocker.requirements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No requirement details were returned. Refresh and try again.
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}

export function RequirementDeleteBlockedDialog({
  blocker,
  onClose,
  onOpenOverviewRequirement,
}: {
  blocker: RequirementDeleteBlocker;
  onClose: () => void;
  onOpenOverviewRequirement: (requirementId: string) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Requirement cannot be deleted
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              [{blocker.requirementId}] is linked to the overview items below.
              Remove the linked requirement from each overview item first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {blocker.overviewRequirements.map((requirement) => (
            <button
              key={requirement.id}
              type="button"
              onClick={() => onOpenOverviewRequirement(requirement.id)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-sm font-semibold text-slate-950">
                [{requirement.id}]: {requirement.product || "Overview item"}
              </div>
              {requirement.remark ? (
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {requirement.remark}
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-500">
                  Open overview item
                </div>
              )}
            </button>
          ))}
          {blocker.overviewRequirements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No overview item details were returned. Refresh and try again.
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}

export function ProjectJsonGeneratorDialog({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (draft: ProjectJsonDraft) => void;
}) {
  const [draft, setDraft] = useState<ProjectJsonDraft>(emptyProjectJsonDraft);
  const dirty = !projectJsonDraftsEqual(draft, emptyProjectJsonDraft);
  const canGenerate = Boolean(
    draft.project_name.trim() &&
    draft.country.trim() &&
    draft.customer.trim() &&
    draft.sales.trim() &&
    draft.created_at,
  );

  function closeDialog() {
    if (dirty && !confirm("Discard this project JSON draft?")) {
      return;
    }
    onClose();
  }

  function updateDraft(nextDraft: ProjectJsonDraft) {
    setDraft(nextDraft);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate) {
      return;
    }
    onGenerate(draft);
  }

  return (
    <Overlay>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Generate Project JSON</h2>
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project Name">
              <input
                value={draft.project_name}
                onChange={(event) =>
                  updateDraft({ ...draft, project_name: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Country">
              <input
                value={draft.country}
                onChange={(event) =>
                  updateDraft({ ...draft, country: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Customer">
              <input
                value={draft.customer}
                onChange={(event) =>
                  updateDraft({ ...draft, customer: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Sales">
              <input
                value={draft.sales}
                onChange={(event) =>
                  updateDraft({ ...draft, sales: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
          </div>
          <Field label="Created at">
            <input
              type="date"
              value={draft.created_at}
              onChange={(event) =>
                updateDraft({ ...draft, created_at: event.target.value })
              }
              className="form-input max-w-52"
              required
            />
          </Field>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              disabled={!canGenerate}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

export function ProjectJsonResultDialog({
  json,
  onClose,
}: {
  json: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);

  async function copyJson() {
    setCopyBlocked(false);
    const didCopy = await copyTextToClipboard(json);
    if (!didCopy) {
      setCopyBlocked(true);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">project.json</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div
          className={`overflow-hidden rounded-lg border transition ${
            copied
              ? "border-emerald-300 ring-2 ring-emerald-100"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              JSON
            </span>
            <button
              type="button"
              onClick={() => void copyJson()}
              className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                copied
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
              }`}
              aria-label={copied ? "Project JSON copied" : "Copy project JSON"}
            >
              {copied ? "✓" : "⧉"}
            </button>
          </div>
          <pre className="max-h-[50vh] overflow-auto bg-slate-950 p-4 text-sm leading-6 text-slate-50">
            <code>{json}</code>
          </pre>
        </div>

        <div
          className={`mt-3 min-h-5 text-sm font-medium transition ${
            copied
              ? "text-emerald-700"
              : copyBlocked
                ? "text-amber-700"
                : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {copied
            ? "Copied to clipboard."
            : copyBlocked
              ? "Clipboard access blocked."
              : " "}
        </div>
      </div>
    </Overlay>
  );
}

export function ProjectSummaryDialog({
  projectName,
  summary,
  onClose,
}: {
  projectName: string;
  summary: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadBlocked, setDownloadBlocked] = useState(false);

  async function copySummary() {
    setCopyBlocked(false);
    setDownloaded(false);
    setDownloadBlocked(false);
    const didCopy = await copyTextToClipboard(summary);
    if (!didCopy) {
      setCopyBlocked(true);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function downloadSummaryPng() {
    setCopied(false);
    setCopyBlocked(false);
    setDownloadBlocked(false);
    const didDownload = downloadSummaryMarkdownAsPng(
      summary,
      projectSummaryPngFilename(projectName),
    );
    if (!didDownload) {
      setDownloadBlocked(true);
      return;
    }
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1800);
  }

  return (
    <Overlay>
      <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Project Summary</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div
          className={`overflow-hidden rounded-lg border transition ${
            copied
              ? "border-emerald-300 ring-2 ring-emerald-100"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Summary
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copySummary()}
                className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                  copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                }`}
                aria-label={
                  copied ? "Project summary copied" : "Copy project summary"
                }
                title="Copy Markdown"
              >
                {copied ? "✓" : "⧉"}
              </button>
              <button
                type="button"
                onClick={() => void downloadSummaryPng()}
                className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                  downloaded
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                }`}
                aria-label={
                  downloaded
                    ? "Project summary image downloaded"
                    : "Download project summary image"
                }
                title="Download PNG"
              >
                {downloaded ? "✓" : "⇩"}
              </button>
            </div>
          </div>
          <pre className="max-h-[60vh] whitespace-pre-wrap overflow-auto bg-slate-950 p-4 text-sm leading-6 text-slate-50">
            <code>{summary}</code>
          </pre>
        </div>

        <div
          className={`mt-3 min-h-5 text-sm font-medium transition ${
            copied || downloaded
              ? "text-emerald-700"
              : copyBlocked || downloadBlocked
                ? "text-amber-700"
                : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {copied
            ? "Copied to clipboard."
            : downloaded
              ? "PNG downloaded."
            : copyBlocked
              ? "Clipboard access blocked."
              : downloadBlocked
                ? "PNG download failed."
              : " "}
        </div>
      </div>
    </Overlay>
  );
}

export function GenerateReportDialog({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (draft: ReportGenerateDraft) => Promise<ReportGenerateResponse>;
}) {
  const today = todayDate();
  const [draft, setDraft] = useState<ReportGenerateDraft>({
    startDate: today,
    endDate: today,
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ReportGenerateResponse | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const dateOrderError =
    draft.startDate && draft.endDate && draft.startDate > draft.endDate
      ? "Start date must be before or equal to end date."
      : "";
  const canGenerate =
    Boolean(draft.startDate && draft.endDate) && !dateOrderError && !generating;

  function updateDraft(nextDraft: ReportGenerateDraft) {
    setDraft(nextDraft);
    setResult(null);
    setSubmitError("");
    setCopied(false);
    setCopyBlocked(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate) {
      return;
    }
    setGenerating(true);
    setSubmitError("");
    setResult(null);
    setCopied(false);
    setCopyBlocked(false);
    try {
      setResult(await onGenerate(draft));
    } catch (requestError) {
      setSubmitError((requestError as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function copyReport() {
    if (result?.status !== "generated") {
      return;
    }
    setCopyBlocked(false);
    const didCopy = await copyTextToClipboard(result.report);
    if (!didCopy) {
      setCopyBlocked(true);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Generate Report</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select an inclusive date range for dashboard activity.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Date ranges of 5 days or longer use a general progress summary
              format.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starting date">
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  updateDraft({ ...draft, startDate: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Ending date">
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  updateDraft({ ...draft, endDate: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
          </div>

          <div className="min-h-6 text-sm font-medium" aria-live="polite">
            {dateOrderError ? (
              <span className="text-red-700">{dateOrderError}</span>
            ) : submitError ? (
              <span className="text-red-700">{submitError}</span>
            ) : result?.status === "no_data" ? (
              <span className="text-amber-700">
                No qualifying ticket or requirement activity was found.
              </span>
            ) : result?.status === "generated" ? (
              <span className="text-emerald-700">
                Report generated. Included {result.ticketCount} tickets and{" "}
                {result.requirementCount} requirements.
              </span>
            ) : (
              <span className="text-slate-400"> </span>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={!canGenerate}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>

        {result?.status === "generated" ? (
          <div className="mt-5">
            <div
              className={`overflow-hidden rounded-lg border transition ${
                copied
                  ? "border-emerald-300 ring-2 ring-emerald-100"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Report
                </span>
                <button
                  type="button"
                  onClick={() => void copyReport()}
                  className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                    copied
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  aria-label={copied ? "Report copied" : "Copy report"}
                  title="Copy report"
                >
                  {copied ? "✓" : "⧉"}
                </button>
              </div>
              <pre className="max-h-[40vh] whitespace-pre-wrap overflow-auto bg-slate-950 p-4 text-sm leading-6 text-slate-50">
                <code>{result.report}</code>
              </pre>
            </div>

            <div
              className={`mt-3 min-h-5 text-sm font-medium transition ${
                copied
                  ? "text-emerald-700"
                  : copyBlocked
                    ? "text-amber-700"
                    : "text-slate-400"
              }`}
              aria-live="polite"
            >
              {copied
                ? "Copied to clipboard."
                : copyBlocked
                  ? "Clipboard access blocked."
                  : " "}
            </div>
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
