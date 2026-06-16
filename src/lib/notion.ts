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
    } catch {
      throw new Error("Failed to fetch roadmap tasks from Notion");
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
