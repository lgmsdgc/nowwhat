import { missionSchema } from "@/lib/validation/models";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function loadMissions(client: SupabaseClient<Database>) {
  const [templates, relationships] = await Promise.all([
    client
      .from("missions")
      .select("id,template")
      .eq("active", true)
      .order("id"),
    client.from("mission_relationships").select("mission_id,relationship_type"),
  ]);
  if (
    templates.error ||
    relationships.error ||
    !templates.data ||
    !relationships.data
  )
    throw new Error(
      "미션 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  // Override embedded relationships with the normalized, reviewed relation table.
  return templates.data.map((row) => {
    const template = missionSchema.parse(row.template);
    if (template.id !== row.id)
      throw new Error("미션 데이터의 형식을 확인해주세요.");
    return missionSchema.parse({
      ...template,
      allowedRelationships: relationships.data
        .filter((r) => r.mission_id === row.id)
        .map((r) => r.relationship_type),
    });
  });
}
