import type { RecentProject } from "./types";
import { RECENT_PROJECTS_KEY } from "./constants";

export function readRecentProjects(): RecentProject[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RecentProject[];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (project) =>
              typeof project.folder === "string" &&
              typeof project.projectName === "string" &&
              typeof project.viewedAt === "string",
          )
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}
