import { useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import type { ReleaseRecord, ReleaseRecordInput } from "@/lib/types";
import { Field, Overlay } from "../ui";

export function ReleaseModelPickerDialog({
  models,
  onClose,
  onSelect,
}: {
  models: string[];
  onClose: () => void;
  onSelect: (model: string) => void;
}) {
  const [model, setModel] = useState(models[0] ?? "");

  return (
    <Overlay>
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Release Record</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        {models.length > 0 ? (
          <>
            <Field label="Model">
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="form-input"
                autoFocus
              >
                {models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onSelect(model)}
                disabled={!model}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            Add at least one model before creating release records.
          </div>
        )}
      </div>
    </Overlay>
  );
}

export function ReleaseRecordsDialog({
  model,
  records,
  loading,
  saving,
  error,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: {
  model: string;
  records: ReleaseRecord[];
  loading: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onAdd: () => Promise<void>;
  onUpdate: (recordId: string, input: ReleaseRecordInput) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
}) {
  const sortedRecords = [...records].sort(sortReleaseRecords);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
      <div className="flex max-h-[88vh] w-full max-w-7xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-medium text-slate-500">Model</div>
            <h2 className="mt-1 text-xl font-semibold">{model}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onAdd()}
              disabled={saving || loading}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Add row
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
            >
              Close
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Loading release records...
            </div>
          ) : sortedRecords.length > 0 ? (
            <div className="min-w-[1180px] overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[560px_minmax(320px,1fr)_260px] border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <div className="p-3">Firmware</div>
                <div className="p-3">ChangeLog</div>
                <div className="p-3">Release Info</div>
              </div>
              <div className="divide-y divide-slate-200">
                {sortedRecords.map((record) => (
                  <ReleaseRecordRow
                    key={`${record.id}-${record.updated_at}`}
                    record={record}
                    saving={saving}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No release records for this model yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReleaseRecordRow({
  record,
  saving,
  onUpdate,
  onDelete,
}: {
  record: ReleaseRecord;
  saving: boolean;
  onUpdate: (recordId: string, input: ReleaseRecordInput) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(record);

  async function saveIfChanged(nextDraft: ReleaseRecord) {
    if (releaseRecordPayloadKey(nextDraft) === releaseRecordPayloadKey(record)) {
      return;
    }
    await onUpdate(record.id, releaseRecordInput(nextDraft));
  }

  async function updateAndSave(nextDraft: ReleaseRecord) {
    setDraft(nextDraft);
    await saveIfChanged(nextDraft);
  }

  function updateFirmware(key: "os" | "ufs" | "se", value: string) {
    setDraft((current) => ({
      ...current,
      firmware: {
        ...current.firmware,
        [key]: value,
      },
    }));
  }

  function updateText(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: "change_log" | "order_time",
  ) {
    setDraft((current) => ({ ...current, [key]: event.target.value }));
  }

  function updateOrderCount(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/\D/g, "");
    const numericValue = Number(value);
    event.target.value = value;
    setDraft((current) => ({
      ...current,
      order_count:
        value === "" || !Number.isFinite(numericValue) || numericValue < 0
          ? null
          : numericValue,
    }));
  }

  async function saveOnBlur(
    event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    event.currentTarget.value = event.currentTarget.value.trim();
    await saveIfChanged({
      ...draft,
      firmware: {
        os: draft.firmware.os.trim(),
        ufs: draft.firmware.ufs.trim(),
        se: draft.firmware.se.trim(),
      },
      change_log: draft.change_log.trim(),
      order_time: draft.order_time.trim(),
    });
  }

  return (
    <div className="grid grid-cols-[560px_minmax(320px,1fr)_260px] bg-white text-sm">
      <div className="space-y-2 p-3">
        <FirmwareInput
          label="OS"
          value={draft.firmware.os}
          disabled={saving}
          onChange={(value) => updateFirmware("os", value)}
          onBlur={saveOnBlur}
        />
        <FirmwareInput
          label="UFS"
          value={draft.firmware.ufs}
          disabled={saving}
          onChange={(value) => updateFirmware("ufs", value)}
          onBlur={saveOnBlur}
        />
        <FirmwareInput
          label="SE"
          value={draft.firmware.se}
          disabled={saving}
          onChange={(value) => updateFirmware("se", value)}
          onBlur={saveOnBlur}
        />
      </div>
      <div className="flex p-3">
        <textarea
          value={draft.change_log}
          onChange={(event) => updateText(event, "change_log")}
          onBlur={(event) => void saveOnBlur(event)}
          disabled={saving}
          className="form-input min-h-full resize-y"
          placeholder="Release changes"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <input
            type="checkbox"
            checked={draft.release_date !== null}
            onChange={(event) => {
              const nextDraft = {
                ...draft,
                release_date: event.target.checked ? todayDate() : null,
              };
              void updateAndSave(nextDraft);
            }}
            disabled={saving}
            aria-label="Released"
          />
          {draft.release_date === null ? (
            <input
              type="text"
              value="Not Released"
              disabled
              className="form-input"
            />
          ) : (
            <input
              type="date"
              value={draft.release_date}
              onChange={(event) =>
                void updateAndSave({
                  ...draft,
                  release_date: event.target.value || null,
                })
              }
              disabled={saving}
              className="form-input"
            />
          )}
        </div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft.order_count ?? ""}
          onChange={updateOrderCount}
          onBlur={(event) => void saveOnBlur(event)}
          disabled={saving}
          className="form-input"
          placeholder="Order Count"
        />
        <button
          type="button"
          onClick={() => void onDelete(record.id)}
          disabled={saving}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function FirmwareInput({
  label,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => void onBlur(event)}
        disabled={disabled}
        className="form-input"
        placeholder={`${label} version`}
      />
    </label>
  );
}

function releaseRecordInput(record: ReleaseRecord): ReleaseRecordInput {
  return {
    model: record.model,
    firmware: {
      os: record.firmware.os,
      ufs: record.firmware.ufs,
      se: record.firmware.se,
    },
    change_log: record.change_log,
    release_date: record.release_date,
    order_count: record.order_count,
    order_time: record.order_time,
  };
}

function releaseRecordPayloadKey(record: ReleaseRecord) {
  return JSON.stringify(releaseRecordInput(record));
}

function sortReleaseRecords(left: ReleaseRecord, right: ReleaseRecord) {
  if (left.release_date === null && right.release_date !== null) {
    return -1;
  }
  if (left.release_date !== null && right.release_date === null) {
    return 1;
  }
  const leftRelease = left.release_date || "";
  const rightRelease = right.release_date || "";
  if (leftRelease !== rightRelease) {
    return rightRelease.localeCompare(leftRelease);
  }
  if (left.order_time !== right.order_time) {
    return right.order_time.localeCompare(left.order_time);
  }
  return right.updated_at.localeCompare(left.updated_at);
}

function todayDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
