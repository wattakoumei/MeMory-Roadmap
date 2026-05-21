import { Client, isFullPage } from "@notionhq/client";

export interface RoadmapTask {
  id: string;
  title: string;
  status: string;
  lastEditedTime: string;
}

export async function getRoadmapTasks(): Promise<RoadmapTask[]> {
  const auth = import.meta.env.NOTION_TOKEN ?? process.env.NOTION_TOKEN;
  const databaseId = import.meta.env.NOTION_DATABASE_ID ?? process.env.NOTION_DATABASE_ID;

  if (!auth || !databaseId) {
    console.warn("NOTION_TOKEN or NOTION_DATABASE_ID is not set");
    return [];
  }

  const notion = new Client({ auth });
  const tasks: RoadmapTask[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "分類",
        select: { equals: "ロードマップ" },
      },
      start_cursor: cursor,
    });

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
