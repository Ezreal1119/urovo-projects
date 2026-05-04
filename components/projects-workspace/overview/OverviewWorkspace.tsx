import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Overview, OverviewRequirement, ProjectInfo, Requirement } from "@/lib/types";
import type { OverviewRequirementDraft, OverviewSettingsDraft, ProjectMode } from "../types";
import { projectModeLabel } from "../labels";
import { formatDate, formatDateTimeFull } from "../formatters";
import { emptyOverviewRequirementDraft, overviewRequirementDraftsEqual, overviewRequirementToDraft, overviewSettingsKey, overviewToSettingsDraft } from "../drafts";
import { Field, LinkedRequirementChips, Overlay, RequirementStatusBadge } from "../ui";

export function ProjectHeader({
  project,
  mode,
  onModeChange,
}: {
  project: ProjectInfo;
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.project_name}
            </h1>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              {project.sales || "Unknown"}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Created at {formatDate(project.created_at)}
          </div>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["overview", "tickets", "requirements"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                mode === item
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              {projectModeLabel(item)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OverviewWorkspace({
  overview,
  requirements,
  allRequirements,
  selectedRequirementId,
  saving,
  onSettingsDirtyChange,
  onSaveSettings,
  onSelect,
  onOpenRequirement,
}: {
  overview: Overview;
  requirements: OverviewRequirement[];
  allRequirements: Requirement[];
  selectedRequirementId: string;
  saving: boolean;
  onSettingsDirtyChange: (dirty: boolean) => void;
  onSaveSettings: (draft: OverviewSettingsDraft) => void | Promise<void>;
  onSelect: (requirementId: string) => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      <OverviewSettingsPanel
        key={overviewSettingsKey(overview)}
        overview={overview}
        saving={saving}
        onDirtyChange={onSettingsDirtyChange}
        onSave={onSaveSettings}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Product demands
          </h2>
          <span className="text-xs text-slate-500">
            {requirements.length} shown
          </span>
        </div>
        <div className="space-y-3">
          {requirements.map((requirement) => (
            <OverviewRequirementCard
              key={requirement.id}
              requirement={requirement}
              active={requirement.id === selectedRequirementId}
              requirements={allRequirements}
              onClick={() => onSelect(requirement.id)}
              onOpenRequirement={onOpenRequirement}
            />
          ))}
        </div>
        {requirements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="text-sm font-medium text-slate-900">
              No product demands yet
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Add models, services, description, or product demand rows.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function OverviewSettingsPanel({
  overview,
  saving,
  onDirtyChange,
  onSave,
}: {
  overview: Overview;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: OverviewSettingsDraft) => void | Promise<void>;
}) {
  const initial = overviewToSettingsDraft(overview);
  const [draft, setDraft] = useState<OverviewSettingsDraft>(initial);

  async function updateAndSave(nextDraft: OverviewSettingsDraft) {
    setDraft(nextDraft);
    await onSave(nextDraft);
    onDirtyChange(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        <ProductListEditor
          label="Models"
          values={draft.models}
          saving={saving}
          onChange={(models) => updateAndSave({ ...draft, models })}
        />
        <ProductListEditor
          label="Services"
          values={draft.others}
          saving={saving}
          onChange={(others) => updateAndSave({ ...draft, others })}
        />
        <DescriptionEditor
          value={draft.description}
          saving={saving}
          onDirtyChange={onDirtyChange}
          onSave={(description) => updateAndSave({ ...draft, description })}
        />
      </div>
    </section>
  );
}

export function ProductListEditor({
  label,
  values,
  saving,
  onChange,
}: {
  label: string;
  values: string[];
  saving: boolean;
  onChange: (values: string[]) => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [value, setValue] = useState("");

  async function addValue() {
    const nextValue = value.trim();
    if (!nextValue || values.includes(nextValue)) {
      return;
    }
    await onChange([...values, nextValue]);
    setValue("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="mr-1 text-xs font-medium text-slate-600">{label}</div>
      {values.length > 0 ? (
        values.map((item) => (
          <span
            key={item}
            className={`relative inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 ${
              deleting ? "pr-5" : ""
            }`}
          >
            {item}
            {deleting ? (
              <button
                type="button"
                onClick={() =>
                  void onChange(values.filter((current) => current !== item))
                }
                disabled={saving}
                className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700 disabled:opacity-60"
                aria-label={`Remove ${item}`}
              >
                x
              </button>
            ) : null}
          </span>
        ))
      ) : (
        <span className="text-sm text-slate-500">
          No {label.toLowerCase()} listed.
        </span>
      )}
      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={saving}
        className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setDeleting((current) => !current)}
        disabled={saving || values.length === 0}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
      >
        {deleting ? "Cancel" : "Delete"}
      </button>
      {adding ? (
        <Overlay>
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add {label}</h3>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setValue("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
              >
                Close
              </button>
            </div>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addValue();
                }
              }}
              className="form-input"
              placeholder={`Add ${label.toLowerCase()}`}
              autoFocus
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void addValue()}
                disabled={saving || !value.trim()}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

export function DescriptionEditor({
  value,
  saving,
  onDirtyChange,
  onSave,
}: {
  value: string;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  async function saveDescription() {
    const nextValue = draft.trim();
    setEditing(false);
    if (nextValue === value) {
      onDirtyChange(false);
      return;
    }
    await onSave(nextValue);
    onDirtyChange(false);
  }

  if (editing) {
    return (
      <Field label="Description">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onDirtyChange(event.target.value.trim() !== value);
          }}
          onBlur={() => void saveDescription()}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(value);
              setEditing(false);
              onDirtyChange(false);
            }
          }}
          className="form-input min-h-28 resize-y"
          placeholder="Project scope, market context, certification notes, or support coverage"
          autoFocus
        />
      </Field>
    );
  }

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-600">Description</div>
      <div
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="min-h-24 cursor-pointer rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 hover:bg-slate-100"
      >
        {saving ? (
          <span className="text-slate-500">Saving...</span>
        ) : value ? (
          <p className="whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-slate-500">No description.</p>
        )}
      </div>
    </div>
  );
}

export function OverviewRequirementCard({
  requirement,
  active,
  requirements,
  onClick,
  onOpenRequirement,
}: {
  requirement: OverviewRequirement;
  active: boolean;
  requirements: Requirement[];
  onClick: () => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
            <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
              {requirement.id}
            </span>
            <span>{requirement.product || "No product selected"}</span>
          </h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {formatDateTimeFull(requirement.created_at)}
        </span>
      </div>
      {requirement.simple_requirements.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
          {requirement.simple_requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No simple requirements.</p>
      )}
      {requirement.remark ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {requirement.remark}
        </p>
      ) : null}
      <div className="mt-3">
        <LinkedRequirementChips
          requirementIds={requirement.linked_requirements}
          requirements={requirements}
          onOpenRequirement={onOpenRequirement}
        />
      </div>
    </div>
  );
}

export function OverviewRequirementModal({
  products,
  requirements,
  saving,
  onClose,
  onCreate,
}: {
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  onClose: () => void;
  onCreate: (draft: OverviewRequirementDraft) => void | Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);

  function closeModal() {
    if (dirty && !confirm("Discard this new overview item draft?")) {
      return;
    }
    onClose();
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Demand</h2>
          <button
            onClick={closeModal}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <OverviewRequirementForm
          initial={{
            ...emptyOverviewRequirementDraft,
            product: products[0] ?? "",
          }}
          products={products}
          requirements={requirements}
          saving={saving}
          submitLabel="Create demand"
          onDirtyChange={setDirty}
          onSubmit={onCreate}
        />
      </div>
    </Overlay>
  );
}

export function OverviewRequirementDrawer({
  requirement,
  products,
  requirements,
  saving,
  onClose,
  onDirtyChange,
  onSave,
  onDelete,
  onOpenRequirement,
}: {
  requirement: OverviewRequirement;
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: OverviewRequirementDraft) => Promise<void>;
  onDelete: () => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  const formId = "overview-demand-detail-form";

  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange, requirement.id]);

  async function saveRequirement(draft: OverviewRequirementDraft) {
    await onSave(draft);
    onDirtyChange(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/20">
      <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <div className="text-xs font-medium text-slate-500">
              {requirement.id}
            </div>
            <h2 className="mt-1 text-xl font-semibold">
              {requirement.product || "Overview item"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="submit"
              form={formId}
              disabled={saving || products.length === 0}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <OverviewRequirementForm
            key={requirement.id}
            formId={formId}
            initial={overviewRequirementToDraft(requirement)}
            products={products}
            requirements={requirements}
            saving={saving}
            submitLabel="Save"
            showSubmitButton={false}
            onDirtyChange={onDirtyChange}
            onLinkedRequirementsChange={saveRequirement}
            onSubmit={saveRequirement}
          />

          {requirement.linked_requirements.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Linked requirements
              </h3>
              <LinkedRequirementChips
                requirementIds={requirement.linked_requirements}
                requirements={requirements}
                onOpenRequirement={onOpenRequirement}
              />
            </section>
          ) : null}

          <div className="flex justify-end">
            <button
              onClick={onDelete}
              disabled={saving}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete overview item
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function OverviewRequirementForm({
  initial,
  products,
  requirements,
  saving,
  submitLabel,
  formId,
  showSubmitButton = true,
  onDirtyChange,
  onLinkedRequirementsChange,
  onSubmit,
}: {
  initial: OverviewRequirementDraft;
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  submitLabel: string;
  formId?: string;
  showSubmitButton?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onLinkedRequirementsChange?: (draft: OverviewRequirementDraft) => Promise<void>;
  onSubmit: (draft: OverviewRequirementDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<OverviewRequirementDraft>(initial);
  const [baseline, setBaseline] = useState<OverviewRequirementDraft>(initial);
  const [requirementPickerOpen, setRequirementPickerOpen] = useState(false);
  const [requirementDeleteMode, setRequirementDeleteMode] = useState(false);
  const [requirementQuery, setRequirementQuery] = useState("");

  const selectableRequirements = requirements.filter((requirement) => {
    const query = requirementQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [
      requirement.id,
      requirement.title,
      requirement.details,
      requirement.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function updateDraft(nextDraft: OverviewRequirementDraft) {
    setDraft(nextDraft);
    onDirtyChange?.(!overviewRequirementDraftsEqual(nextDraft, baseline));
  }

  async function saveLinkedRequirements(nextDraft: OverviewRequirementDraft) {
    updateDraft(nextDraft);
    if (!onLinkedRequirementsChange) {
      return;
    }
    await onLinkedRequirementsChange(nextDraft);
    setBaseline(nextDraft);
    onDirtyChange?.(false);
  }

  async function addLinkedRequirement(requirementId: string) {
    if (draft.linked_requirements.includes(requirementId)) {
      return;
    }
    await saveLinkedRequirements({
      ...draft,
      linked_requirements: [...draft.linked_requirements, requirementId],
    });
  }

  async function removeLinkedRequirement(requirementId: string) {
    await saveLinkedRequirements({
      ...draft,
      linked_requirements: draft.linked_requirements.filter(
        (current) => current !== requirementId,
      ),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(draft);
    setBaseline(draft);
    onDirtyChange?.(false);
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <Field label="Product">
        <select
          required
          value={draft.product}
          onChange={(event) =>
            updateDraft({ ...draft, product: event.target.value })
          }
          className="form-input"
        >
          <option value="" disabled>
            Select product
          </option>
          {products.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </Field>
      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
          Add at least one model or service before creating overview items.
        </div>
      ) : null}
      <TextListEditor
        label="Simple requirements"
        values={draft.simple_requirements}
        placeholder="Add one sentence"
        onChange={(simple_requirements) =>
          updateDraft({ ...draft, simple_requirements })
        }
      />
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-xs font-medium text-slate-600">
            Linked requirements
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRequirementPickerOpen(true)}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setRequirementDeleteMode((current) => !current)}
              disabled={draft.linked_requirements.length === 0}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {requirementDeleteMode ? "Cancel" : "Delete"}
            </button>
          </div>
        </div>
        {draft.linked_requirements.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            {draft.linked_requirements.map((requirementId) => (
              <span
                key={requirementId}
                className={`relative inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 ${
                  requirementDeleteMode ? "pr-5" : ""
                }`}
              >
                {requirementId}
                {requirementDeleteMode ? (
                  <button
                    type="button"
                    onClick={() => void removeLinkedRequirement(requirementId)}
                    disabled={saving}
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700"
                    aria-label={`Remove ${requirementId}`}
                  >
                    x
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
            No linked requirements selected.
          </div>
        )}
      </div>
      <Field label="Remark">
        <textarea
          value={draft.remark}
          onChange={(event) =>
            updateDraft({ ...draft, remark: event.target.value })
          }
          className="form-input min-h-24 resize-y"
          placeholder="Context, deployment notes, or certification detail"
        />
      </Field>
      {requirementPickerOpen ? (
        <Overlay>
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add linked requirement</h3>
              <button
                type="button"
                onClick={() => setRequirementPickerOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
              >
                Close
              </button>
            </div>
            <input
              value={requirementQuery}
              onChange={(event) => setRequirementQuery(event.target.value)}
              className="mb-3 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder="Search by requirement ID, title, status, or details"
            />
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {selectableRequirements.map((requirement) => {
                const selected = draft.linked_requirements.includes(
                  requirement.id,
                );
                return (
                  <button
                    key={requirement.id}
                    type="button"
                    onClick={() => {
                      void addLinkedRequirement(requirement.id);
                      setRequirementPickerOpen(false);
                      setRequirementQuery("");
                    }}
                    disabled={selected || saving}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selected
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          [{requirement.id}] {requirement.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {requirement.details || "No details."}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {selected ? (
                          <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium">
                            Selected
                          </span>
                        ) : (
                          <RequirementStatusBadge status={requirement.status} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {selectableRequirements.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No requirements match this search.
                </div>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}
      {showSubmitButton ? (
        <button
          disabled={saving || products.length === 0}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      ) : null}
    </form>
  );
}

export function TextListEditor({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  function addValue() {
    const nextValue = value.trim();
    if (!nextValue || values.includes(nextValue)) {
      return;
    }
    onChange([...values, nextValue]);
    setValue("");
  }

  function startEdit(index: number) {
    if (deleteMode) {
      return;
    }
    setEditingIndex(index);
    setEditingValue(values[index] ?? "");
  }

  function saveEdit(index: number) {
    const nextValue = editingValue.trim();
    setEditingIndex(null);
    setEditingValue("");

    if (!nextValue) {
      return;
    }

    const duplicate = values.some(
      (current, currentIndex) => currentIndex !== index && current === nextValue,
    );
    if (duplicate || values[index] === nextValue) {
      return;
    }

    onChange(values.map((current, currentIndex) => (currentIndex === index ? nextValue : current)));
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditingValue("");
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="block text-xs font-medium text-slate-600">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addValue}
            disabled={!value.trim()}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteMode((current) => !current);
              cancelEdit();
            }}
            disabled={values.length === 0}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {deleteMode ? "Cancel" : "Delete"}
          </button>
        </div>
      </div>
      <div>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          className="form-input"
          placeholder={placeholder}
        />
      </div>
      {values.length > 0 ? (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {values.map((item, index) => {
            const editing = editingIndex === index;
            return (
              <div
                key={`${item}-${index}`}
                className={`relative rounded-md border border-slate-200 bg-white text-sm text-slate-700 ${
                  deleteMode ? "pr-5" : ""
                }`}
              >
                {editing ? (
                  <textarea
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => saveEdit(index)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className="min-h-20 w-full resize-y rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    disabled={deleteMode}
                    className={`w-full whitespace-pre-wrap rounded-md px-3 py-2 text-left leading-6 ${
                      deleteMode
                        ? "cursor-default"
                        : "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    }`}
                  >
                    {item}
                  </button>
                )}
                {deleteMode ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(values.filter((_, currentIndex) => currentIndex !== index))
                    }
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700"
                    aria-label={`Remove ${item}`}
                  >
                    x
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
          No {label.toLowerCase()} added.
        </div>
      )}
    </div>
  );
}
