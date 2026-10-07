import { authenticatedDatabase } from "@/lib/supabase/server";
import { gameApiError, privateJson, readCommand } from "@/lib/http/gameApi";
import { executeGame, readGame } from "@/services/serverGameService";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return privateJson({
      state: await readGame(await authenticatedDatabase(request)),
    });
  } catch (error) {
    return gameApiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = await readCommand(request);
    const database = await authenticatedDatabase(request);
    return privateJson(
      await executeGame(
        database,
        input.command,
        input.timeZone,
        undefined,
        input.analytics,
      ),
    );
  } catch (error) {
    return gameApiError(error);
  }
}
