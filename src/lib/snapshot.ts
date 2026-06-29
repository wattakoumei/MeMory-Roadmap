import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { RoadmapTask } from "./notion";

const SNAPSHOT_PATH = resolve(process.cwd(), "data/roadmap-snapshot.json");

interface SnapshotEntry {
  status: string;
  isNew: boolean;
}

interface Snapshot {
  statusUpdatedAt: string;
  tasks: Record<string, SnapshotEntry>;
}

export interface NewFlagResult {
  tasks: RoadmapTask[];
  statusUpdatedAt: string | null;
}

/** "sv-SE" ロケールは YYYY-MM-DD 形式を返すので、JST の日付文字列を得るのに使う */
function todayJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function readSnapshot(): Snapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.tasks) {
      return parsed as Snapshot;
    }
  } catch {
    // 壊れている場合は初回扱いにフォールバック
  }
  return null;
}

function writeSnapshot(snapshot: Snapshot): void {
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
}

/**
 * 前回ビルド時のスナップショットと比較し、各タスクに isNew フラグを付与する。
 * - 前回に存在しないタスク（新規追加）→ New
 * - 前回とステータスが変わったタスク → New
 * - ステータスが変わっていないタスク → 前回の New 状態を引き継ぐ（次にそのステータスが動くまで残す）
 * 初回（スナップショット未作成）は基準作りのみで、全タスク New=false とする。
 *
 * persist=true のとき、今回の状態を新スナップショットとして書き出す（本番ビルドのみ想定）。
 * statusUpdatedAt は「最後にステータス変化（または新規追加）が起きた日」を JST で表す。
 */
export function applyNewFlags(
  tasks: RoadmapTask[],
  persist = false
): NewFlagResult {
  const prev = readSnapshot();
  const isFirstRun = prev === null;
  let changedToday = false;

  const flagged: RoadmapTask[] = tasks.map((task) => {
    const prevEntry = prev?.tasks[task.id];
    let isNew: boolean;

    if (isFirstRun) {
      isNew = false;
    } else if (!prevEntry) {
      isNew = true; // 新規追加
      changedToday = true;
    } else if (prevEntry.status !== task.status) {
      isNew = true; // ステータス変化
      changedToday = true;
    } else {
      isNew = prevEntry.isNew ?? false; // 変化なし → 前回の New 状態を引き継ぐ
    }

    return { ...task, isNew };
  });

  const statusUpdatedAt = isFirstRun
    ? null
    : changedToday
      ? todayJst()
      : (prev.statusUpdatedAt ?? null);

  if (persist) {
    const next: Snapshot = {
      statusUpdatedAt: statusUpdatedAt ?? todayJst(),
      tasks: Object.fromEntries(
        flagged.map((t) => [t.id, { status: t.status, isNew: t.isNew ?? false }])
      ),
    };
    writeSnapshot(next);
  }

  return { tasks: flagged, statusUpdatedAt };
}
