import { z } from "zod";
import { commandRequestSchema } from "@/lib/validation/commands";
import { GameError } from "@/services/gameplayService";
import { RevisionConflict } from "@/services/serverGameService";

export class RequestFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const privateJson = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function readCommand(request: Request) {
  return commandRequestSchema.parse(await readJson(request, 16384));
}
export async function readJson(request: Request, maxBytes: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new RequestFailure("JSON 형식으로 요청해주세요.", 415);
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new RequestFailure("입력 내용이 너무 길어요.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestFailure("요청 내용이 없어요.", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestFailure("입력 내용이 너무 길어요.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestFailure("요청 내용을 확인해주세요.", 400);
  }
  return body;
}
export function gameApiError(error: unknown) {
  if (error instanceof z.ZodError)
    return privateJson({ error: "입력 형식을 확인해주세요." }, 400);
  if (error instanceof GameError || error instanceof RevisionConflict)
    return privateJson({ error: error.message }, 409);
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  )
    return privateJson({ error: error.message }, error.status);
  return privateJson(
    { error: "서버 연결을 확인한 뒤 다시 시도해주세요." },
    503,
  );
}
