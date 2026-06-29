import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client, isFullPage } from "@notionhq/client";
import type { QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { getServerEnv } from "./server-env";

export interface RoadmapTask {
  id: string;
  title: string;
  status: string;
  lastEditedTime: string;
  /** 前回ビルドからステータスが変わった（または新規追加された）場合に true。snapshot.ts で付与 */
  isNew?: boolean;
}

export async function getRoadmapTasks(): Promise<RoadmapTask[]> {
  const auth = getServerEnv("NOTION_TOKEN");
  const databaseId = getServerEnv("NOTION_DATABASE_ID");

  if (!auth || !databaseId) {
    console.warn("NOTION_TOKEN or NOTION_DATABASE_ID is not set");
    return [];
  }

  const notion = new Client({ auth });
  const tasks: RoadmapTask[] = [];
  let cursor: string | undefined;

  do {
    let response: QueryDatabaseResponse;
    try {
      response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "分類",
          select: { equals: "ロードマップ" },
        },
        start_cursor: cursor,
      });
    } catch (e) {
      console.warn(
        `Notion API request failed (${describeNotionError(e)}); falling back to snapshot.`
      );
      return loadTasksFromSnapshot();
    }

    for (const page of response.results) {
      if (!isFullPage(page)) continue;

      const props = page.properties as Record<string, any>;

      const titleProp = Object.values(props).find(
        (p: any) => p.type === "title"
      ) as any;
      const title: string =
        titleProp?.title?.map((t: any) => t.plain_text).join("") ?? "";

      const statusProp = props["ステータス"];
      const status: string =
        statusProp?.type === "status"
          ? (statusProp.status?.name ?? "Backlog")
          : "Backlog";

      if (title) {
        tasks.push({
          id: page.id,
          title,
          status,
          lastEditedTime: page.last_edited_time,
        });
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return tasks;
}

function loadTasksFromSnapshot(): RoadmapTask[] {
  const snapshotPath = resolve(process.cwd(), "data/roadmap-snapshot.json");
  if (!existsSync(snapshotPath)) return [];
  try {
    const data = JSON.parse(readFileSync(snapshotPath, "utf8"));
    return Object.entries(data.tasks ?? {}).map(([id, entry]: [string, any]) => ({
      id,
      title: entry.title ?? "",
      status: entry.status ?? "Backlog",
      lastEditedTime: entry.lastEditedTime ?? "",
    }));
  } catch {
    return [];
  }
}

function describeNotionError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);

  const detail = error as {
    code?: string;
    errno?: string;
    message?: string;
    name?: string;
    status?: number;
  };

  return [
    detail.name,
    detail.status ? `status=${detail.status}` : undefined,
    detail.code ? `code=${detail.code}` : undefined,
    detail.errno ? `errno=${detail.errno}` : undefined,
    redactNotionIdentifiers(detail.message),
  ]
    .filter(Boolean)
    .join("; ");
}

function redactNotionIdentifiers(message: string | undefined): string | undefined {
  return message
    ?.replace(
      /https:\/\/api\.notion\.com\/v1\/databases\/[^/\s]+\/query/g,
      "https://api.notion.com/v1/databases/[database_id]/query"
    )
    .replace(/\b[0-9a-f]{32}\b/gi, "[notion_id]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[notion_id]"
    );
}
