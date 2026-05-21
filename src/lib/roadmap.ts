import type { RoadmapTask } from "./notion";

export const STATUS_CONFIG = [
  { notion: "Backlog",     label: "考え中",       color: "#333333" },
  { notion: "Ready",      label: "次の開発",     color: "#333388" },
  { notion: "In Progress",label: "開発中",       color: "#7DB3E8" },
  { notion: "Review",     label: "リリース準備中", color: "#7DC8B8" },
  { notion: "Done",       label: "リリース済",   color: "#88C99A" },
] as const;

const HIDDEN_STATUSES = new Set(["Archive"]);
const DONE_INITIAL_COUNT = 20;

export interface SectionData {
  notion: string;
  label: string;
  color: string;
  initialTasks: RoadmapTask[];
  extraTasks: RoadmapTask[];
  hasMore: boolean;
}

export function processRoadmapTasks(tasks: RoadmapTask[]): SectionData[] {
  const visible = tasks.filter((t) => !HIDDEN_STATUSES.has(t.status));

  return STATUS_CONFIG.map((config) => {
    let sectionTasks = visible.filter((t) => t.status === config.notion);

    if (config.notion === "Done") {
      sectionTasks.sort(
        (a, b) =>
          new Date(b.lastEditedTime).getTime() -
          new Date(a.lastEditedTime).getTime()
      );
    }

    const hasMore = sectionTasks.length > DONE_INITIAL_COUNT;
    const initialTasks = hasMore
      ? sectionTasks.slice(0, DONE_INITIAL_COUNT)
      : sectionTasks;
    const extraTasks = hasMore ? sectionTasks.slice(DONE_INITIAL_COUNT) : [];

    return { ...config, initialTasks, extraTasks, hasMore };
  });
}
