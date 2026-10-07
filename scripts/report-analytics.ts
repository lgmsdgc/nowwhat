import { readFileSync } from "node:fs";
import { z } from "zod";
import { localStateSchema } from "../lib/validation/models";
import { analyticsEventSchema } from "../lib/validation/analytics";
import { analyticsReport } from "../services/analyticsReportService";

const path = process.argv[2];
if (!path) {
  console.error(
    "Usage: npm run analytics:report -- <local-state-or-records.json>",
  );
  process.exitCode = 1;
} else {
  try {
    const data: unknown = JSON.parse(readFileSync(path, "utf8"));
    const local = localStateSchema.safeParse(data);
    const recordSchema = z.array(
      z.strictObject({ ownerId: z.uuid(), event: analyticsEventSchema }),
    );
    const records = local.success
      ? local.data.analyticsEvents.map((event) => ({
          ownerId: local.data.anonymousId,
          event,
        }))
      : recordSchema.parse(
          typeof data === "object" && data !== null && "records" in data
            ? data.records
            : data,
        );
    console.log(JSON.stringify(analyticsReport(records), null, 2));
  } catch {
    console.error("Could not read a valid NowWhat analytics export.");
    process.exitCode = 1;
  }
}
