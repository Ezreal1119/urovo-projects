import { useState } from "react";
import type { FormEvent } from "react";
import type { ProjectJsonDraft, ReportGenerateDraft, ReportGenerateResponse, RequirementDeleteBlocker, TicketDeleteBlocker } from "../types";
import { emptyProjectJsonDraft, projectJsonDraftsEqual } from "../drafts";
import { copyTextToClipboard, downloadSummaryMarkdownAsPng, projectSummaryPngFilename } from "../summary";
import { todayDate } from "../formatters";
import { Field, Overlay } from "../ui";

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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate) {
      return;
    }
    setGenerating(true);
    setSubmitError("");
    setResult(null);
    try {
      setResult(await onGenerate(draft));
    } catch (requestError) {
      setSubmitError((requestError as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
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
                No qualifying ticket or requirement activity was found. No email
                was sent.
              </span>
            ) : result?.status === "sent" ? (
              <span className="text-emerald-700">
                Report sent. Included {result.ticketCount} tickets and{" "}
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
      </div>
    </Overlay>
  );
}
