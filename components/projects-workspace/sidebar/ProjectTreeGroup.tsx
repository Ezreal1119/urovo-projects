import { useState } from "react";
import type { ProjectGroup } from "../types";

export function ProjectTreeGroup({
  group,
  selectedFolder,
  onSelect,
}: {
  group: ProjectGroup;
  selectedFolder: string;
  onSelect: (folder: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
        aria-expanded={expanded}
      >
        <span className="w-3 text-slate-400">{expanded ? "▾" : "▸"}</span>
        <span className="truncate">{group.country}</span>
        <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
          {group.projects.length}
        </span>
      </button>
      {expanded ? (
        <div className="ml-3 border-l border-slate-200 pl-2">
          {group.projects.map(({ folder, project }) => (
            <button
              key={folder}
              onClick={() => onSelect(folder)}
              className={`mt-1 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition ${
                folder === selectedFolder
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {project.project_name}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
