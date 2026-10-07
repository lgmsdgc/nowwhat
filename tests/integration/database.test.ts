import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missionSchema } from "@/lib/validation/models";
import { storedGameSchema } from "@/lib/validation/commands";
import {
  executeGame,
  readGame,
  RevisionConflict,
  type GameDatabase,
} from "@/services/serverGameService";
import { missions } from "@/seed/missions";
import type { GameCommand } from "@/services/gameplayService";
import type { LocalState } from "@/types/game";
import type { OnboardingAnswers } from "@/types/recommendation";
import { prepareLocalImport } from "@/services/localImportService";
import { achievements } from "@/seed/achievements";
import { localProgression } from "@/services/progressionService";
import type { AchievementUnlock } from "@/types/progression";
import type { Mission } from "@/types/game";
import type { AnalyticsContext } from "@/types/analytics";
import { analyticsEventSchema } from "@/lib/validation/analytics";
import type { ClientEvent, AnalyticsEvent } from "@/types/analytics";
import { makeClientEvent, gameAnalytics } from "@/services/analyticsService";
import { analyticsReport } from "@/services/analyticsReportService";

let db: PGlite;
const answers: OnboardingAnswers = {
  relationship: "solo",
  durationMinutes: 15,
  budgetPerPerson: 0,
  travelScope: "home",
  energy: 1,
  intensity: "random",
};
const now = () => new Date("2026-10-06T03:00:00.000Z");
const schemaSql = readFileSync(
  "supabase/migrations/202610060001_game_schema.sql",
  "utf8",
);
const seedSql = readFileSync(
  "supabase/migrations/202610060002_seed_missions.sql",
  "utf8",
);
const progressionSeedSql = readFileSync(
  "supabase/migrations/202610070003_progression_seed.sql",
  "utf8",
);

beforeAll(async () => {
  db = await PGlite.create();
  // Hosted Auth is not simulated. Only its SQL interface is bootstrapped, so
  // migrations, grants, RLS, constraints and transactions run in real PostgreSQL.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; create table auth.users(id uuid primary key, is_anonymous boolean not null default true);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to anon, authenticated, service_role;`);
  await db.exec(schemaSql);
  await db.exec(seedSql);
  await db.exec(
    readFileSync("supabase/migrations/202610070001_accounts.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610070002_progression.sql", "utf8"),
  );
  await db.exec(progressionSeedSql);
  await db.exec(
    readFileSync("supabase/migrations/202610070004_analytics.sql", "utf8"),
  );
});
afterAll(async () => {
  await db?.close();
});

function asRole<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      userId ?? "",
    ]);
    return fn(tx);
  });
}
async function newUser() {
  const id = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [id]);
  const database: GameDatabase = {
    read: () =>
      asRole(
        "authenticated",
        id,
        async (tx) =>
          (
            await tx.query<{ data: unknown }>(
              "select public.get_game_state() as data",
            )
          ).rows[0].data,
      ),
    missions: async () =>
      (
        await db.query<{ template: unknown }>(
          "select template from public.missions where active order by id",
        )
      ).rows.map((row) => missionSchema.parse(row.template)),
    commit: async (revision, state, context) => {
      try {
        await asRole("service_role", null, (tx) =>
          tx.query(
            "select public.commit_game_state($1, $2, $3::jsonb, $4::jsonb)",
            [
              id,
              revision,
              JSON.stringify(state),
              context ? JSON.stringify(context) : null,
            ],
          ),
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "40001"
        )
          throw new RevisionConflict();
        throw error;
      }
    },
  };
  const initial = await readGame(database);
  return { id, database, initial };
}
const run = (database: GameDatabase, command: GameCommand) =>
  executeGame(database, command, "Asia/Seoul", now);
async function checked(database: GameDatabase) {
  const requested = await run(database, { type: "request", answers });
  const sessionId = requested.sessionId!;
  await run(database, { type: "start", sessionId });
  for (
    let index = 0;
    index < requested.state.sessions[0].mission.steps.length;
    index++
  )
    await run(database, { type: "check", sessionId, index, checked: true });
  return sessionId;
}

describe("PostgreSQL migrations and access boundaries", () => {
  it("loads all 60 templates and normalized relationships, and seed can be reapplied", async () => {
    await db.exec(seedSql);
    await db.exec(progressionSeedSql);
    const rows = (
      await db.query<{ template: unknown }>(
        "select template from public.missions order by id",
      )
    ).rows;
    expect(rows.map((r) => missionSchema.parse(r.template))).toEqual(
      [...missions].sort((a, b) => a.id.localeCompare(b.id, "en")),
    );
    const count = (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.mission_relationships",
      )
    ).rows[0].count;
    expect(count).toBe(
      missions.reduce((sum, m) => sum + m.allowedRelationships.length, 0),
    );
  });
  it("anonymous visitors see only active catalogs and cannot initialize private records", async () => {
    const rows = await asRole("anon", null, (tx) =>
      tx.query("select id from public.missions"),
    );
    expect(rows.rows).toHaveLength(60);
    await expect(
      asRole("anon", null, (tx) => tx.query("select * from public.profiles")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("anon", null, (tx) => tx.query("select public.get_game_state()")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("authenticated", null, (tx) =>
        tx.query("select public.get_game_state()"),
      ),
    ).rejects.toThrow(/Authentication required/);
  });
  it("isolates two Auth users' profiles, sessions and feedback", async () => {
    const a = await newUser(),
      b = await newUser();
    await run(a.database, { type: "request", answers });
    for (const table of [
      "profiles",
      "mission_sessions",
      "recommendation_feedback",
    ]) {
      const rows = await asRole("authenticated", b.id, (tx) =>
        tx.query(`select * from public.${table}`),
      );
      expect(rows.rows).toHaveLength(table === "profiles" ? 1 : 0);
    }
    expect((await readGame(b.database)).sessions).toHaveLength(0);
    const own = await asRole("authenticated", a.id, (tx) =>
      tx.query("select * from public.mission_sessions"),
    );
    expect(own.rows).toHaveLength(1);
  });
  it("denies direct EXP/session/achievement writes and privileged RPC to browser roles", async () => {
    const user = await newUser();
    for (const sql of [
      "update public.profiles set exp=999999",
      "delete from public.mission_sessions",
      "insert into public.user_achievements values(gen_random_uuid(),'fake',now())",
    ])
      await expect(
        asRole("authenticated", user.id, (tx) => tx.query(sql)),
      ).rejects.toThrow(/permission denied/);
    for (const role of ["anon", "authenticated"] as const)
      await expect(
        asRole(role, user.id, (tx) =>
          tx.query("select public.commit_game_state($1,0,$2::jsonb)", [
            user.id,
            JSON.stringify(user.initial),
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
  });
  it("hides inactive catalog and corresponding relationship rows", async () => {
    const mission = missions[0];
    await db.query(
      "update public.missions set template=jsonb_set(template,'{active}','false') where id=$1",
      [mission.id],
    );
    try {
      const templates = await asRole("anon", null, (tx) =>
        tx.query("select id from public.missions where id=$1", [mission.id]),
      );
      const relations = await asRole("anon", null, (tx) =>
        tx.query(
          "select * from public.mission_relationships where mission_id=$1",
          [mission.id],
        ),
      );
      expect(templates.rows).toHaveLength(0);
      expect(relations.rows).toHaveLength(0);
    } finally {
      await db.query(
        "update public.missions set template=$2::jsonb where id=$1",
        [mission.id, JSON.stringify(mission)],
      );
    }
  });
});

describe("atomic server gameplay", () => {
  it("persists request → reroll → start → checklist → complete, exactly once", async () => {
    const { id, database } = await newUser();
    const first = await run(database, { type: "request", answers });
    const next = await run(database, {
      type: "reroll",
      sessionId: first.sessionId!,
      reason: "not_fun",
    });
    expect(next.state.sessions).toHaveLength(2);
    expect(
      (
        await run(database, {
          type: "reroll",
          sessionId: first.sessionId!,
          reason: "not_fun",
        })
      ).sessionId,
    ).toBe(next.sessionId);
    const sessionId = await checked(database);
    const command: GameCommand = {
      type: "complete",
      sessionId,
      input: {
        actualCost: 0,
        rating: 5,
        wouldDoAgain: true,
        comment: "생각보다 재밌었음",
      },
    };
    const result = await run(database, command);
    const retry = await run(database, command);
    expect(retry.state).toEqual(result.state);
    const profile = (
      await db.query<{ exp: number; level: number }>(
        "select exp,level from public.profiles where id=$1",
        [id],
      )
    ).rows[0];
    expect(profile.exp).toBe(result.state.sessions[1].mission.baseExp);
    expect(profile.level).toBe(Math.floor(profile.exp / 300) + 1);
    const saved = (
      await db.query<{
        actual_cost: number;
        rating: number;
        awarded_exp: number;
      }>(
        "select actual_cost,rating,awarded_exp from public.mission_sessions where id=$1",
        [sessionId],
      )
    ).rows[0];
    expect(saved).toEqual({
      actual_cost: 0,
      rating: 5,
      awarded_exp: profile.exp,
    });
    expect(
      result.state.feedback.filter((f) => f.action === "completed"),
    ).toHaveLength(1);
    expect(
      result.state.feedback.filter((f) => f.action === "liked"),
    ).toHaveLength(1);
    expect(
      result.state.feedback.find((f) => f.action === "rejected")?.reason,
    ).toBe("not_fun");
  });
  it("retries concurrent requests against the latest revision without double recommendations", async () => {
    const { database } = await newUser();
    const [a, b] = await Promise.all([
      run(database, { type: "request", answers }),
      run(database, { type: "request", answers }),
    ]);
    expect(a.sessionId).toBe(b.sessionId);
    expect((await readGame(database)).sessions).toHaveLength(1);
  });
  it("rejects stale revisions before any write", async () => {
    const { database } = await newUser();
    const before = storedGameSchema.parse(await database.read());
    await run(database, { type: "request", answers });
    await expect(
      database.commit(before.revision, before.state),
    ).rejects.toBeInstanceOf(RevisionConflict);
    expect((await readGame(database)).sessions).toHaveLength(1);
  });
  it("rolls back session insertion if later feedback fails", async () => {
    const { database } = await newUser();
    const before = storedGameSchema.parse(await database.read());
    const capture: GameDatabase = { ...database, commit: async () => {} };
    const computed = await run(capture, { type: "request", answers });
    computed.state.feedback[0].missionId = "nonexistent";
    await expect(
      database.commit(before.revision, computed.state),
    ).rejects.toThrow(/Invalid feedback owner/);
    expect(storedGameSchema.parse(await database.read())).toEqual(before);
    expect((await readGame(database)).sessions).toHaveLength(0);
  });
  it("prevents cross-owner ID replacement and history deletion", async () => {
    const a = await newUser(),
      b = await newUser();
    const result = await run(a.database, { type: "request", answers });
    const before = storedGameSchema.parse(await b.database.read());
    const forged: LocalState = structuredClone(result.state);
    forged.anonymousId = b.initial.anonymousId;
    forged.createdAt = b.initial.createdAt;
    forged.sessions[0].anonymousId = b.initial.anonymousId;
    forged.feedback = [];
    await expect(b.database.commit(before.revision, forged)).rejects.toThrow(
      /Immutable history/,
    );
    expect((await readGame(b.database)).sessions).toHaveLength(0);
    const current = storedGameSchema.parse(await a.database.read());
    await expect(
      a.database.commit(current.revision, a.initial),
    ).rejects.toThrow(/History cannot be removed/);
  });
  it("keeps completed rewards immutable and abandonment grants no EXP", async () => {
    const { id, database } = await newUser();
    const sessionId = await checked(database);
    await run(database, {
      type: "complete",
      sessionId,
      input: {
        actualCost: null,
        rating: null,
        wouldDoAgain: null,
        comment: "",
      },
    });
    const current = storedGameSchema.parse(await database.read());
    const altered = structuredClone(current.state);
    altered.sessions[0].result!.awardedExp++;
    await expect(database.commit(current.revision, altered)).rejects.toThrow(
      /Immutable history/,
    );
    const next = await run(database, { type: "request", answers });
    await run(database, { type: "start", sessionId: next.sessionId! });
    await run(database, { type: "abandon", sessionId: next.sessionId! });
    const total = (
      await db.query<{ exp: number }>(
        "select exp from public.profiles where id=$1",
        [id],
      )
    ).rows[0].exp;
    expect(total).toBe(current.state.sessions[0].result!.awardedExp);
  });
});

async function member() {
  const user = await newUser();
  await db.query("update auth.users set is_anonymous=false where id=$1", [
    user.id,
  ]);
  return user;
}
async function proof(source: string) {
  const hash = randomUUID().replaceAll("-", "").repeat(2);
  await asRole("service_role", null, (tx) =>
    tx.query("select public.prepare_account_migration($1,$2)", [source, hash]),
  );
  return hash;
}
const claim = (target: string, hash: string) =>
  asRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx.query<{ moved: number }>(
          "select public.claim_account_migration($1,$2) as moved",
          [target, hash],
        )
      ).rows[0].moved,
  );
async function completed(database: GameDatabase) {
  const sessionId = await checked(database);
  await run(database, {
    type: "complete",
    sessionId,
    input: {
      actualCost: 0,
      rating: 5,
      wouldDoAgain: true,
      comment: "가입 전 미션",
    },
  });
  return sessionId;
}
const importRecords = (target: string, source: string, records: unknown) =>
  asRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx.query<{ added: number }>(
          "select public.import_local_history($1,$2,$3::jsonb) as added",
          [target, source, JSON.stringify(records)],
        )
      ).rows[0].added,
  );

describe("account linking and proven anonymous-account migration", () => {
  it("keeps the same ID, history and EXP when an anonymous identity becomes permanent", async () => {
    const user = await newUser();
    const sessionId = await completed(user.database);
    const before = await readGame(user.database);
    const hash = await proof(user.id);
    await db.query("update auth.users set is_anonymous=false where id=$1", [
      user.id,
    ]);
    expect(await claim(user.id, hash)).toBe(0);
    expect(await readGame(user.database)).toEqual(before);
    expect(before.sessions[0].id).toBe(sessionId);
  });
  it("merges two verified owners atomically, preserving session URLs and rewarding once", async () => {
    const src = await newUser(),
      dst = await member();
    const sourceSession = await completed(src.database);
    await completed(dst.database);
    const hash = await proof(src.id);
    expect(await claim(dst.id, hash)).toBe(1);
    expect(await claim(dst.id, hash)).toBe(0);
    const merged = await readGame(dst.database);
    expect(merged.sessions).toHaveLength(2);
    expect(
      merged.sessions.find((s) => s.id === sourceSession)?.result?.comment,
    ).toBe("가입 전 미션");
    expect(
      merged.sessions.every((s) => s.anonymousId === dst.initial.anonymousId),
    ).toBe(true);
    expect(
      merged.feedback.every((f) => f.anonymousId === dst.initial.anonymousId),
    ).toBe(true);
    const exp = (
      await db.query<{ exp: number }>(
        "select exp from public.profiles where id=$1",
        [dst.id],
      )
    ).rows[0].exp;
    expect(exp).toBe(
      merged.sessions.reduce((sum, s) => sum + s.result!.awardedExp, 0),
    );
    await expect(readGame(src.database)).rejects.toThrow(
      /Account already migrated/,
    );
    const revision = (
      await db.query<{ revision: number }>(
        "select revision from public.profiles where id=$1",
        [src.id],
      )
    ).rows[0].revision;
    await expect(src.database.commit(revision, src.initial)).rejects.toThrow(
      /Account already migrated/,
    );
    expect(
      (
        await asRole("authenticated", src.id, (tx) =>
          tx.query("select * from public.mission_sessions"),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asRole("authenticated", src.id, (tx) =>
          tx.query("select * from public.recommendation_feedback"),
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("keeps the destination active mission and closes the source active mission without EXP", async () => {
    const src = await newUser(),
      dst = await member();
    const a = await run(src.database, { type: "request", answers });
    await run(src.database, { type: "start", sessionId: a.sessionId! });
    const b = await run(dst.database, { type: "request", answers });
    const hash = await proof(src.id);
    await claim(dst.id, hash);
    const state = await readGame(dst.database);
    expect(state.sessions.find((s) => s.id === a.sessionId)?.status).toBe(
      "abandoned",
    );
    expect(state.sessions.find((s) => s.id === b.sessionId)?.status).toBe(
      "recommended",
    );
    expect(
      state.sessions.filter(
        (s) => s.status === "started" || s.status === "recommended",
      ),
    ).toHaveLength(1);
    expect(state.feedback.filter((f) => f.action === "abandoned")).toHaveLength(
      1,
    );
  });
  it("moves a source active mission when the destination has none, and gameplay can resume", async () => {
    const src = await newUser(),
      dst = await member();
    const a = await run(src.database, { type: "request", answers });
    await claim(dst.id, await proof(src.id));
    const resumed = await run(dst.database, {
      type: "start",
      sessionId: a.sessionId!,
    });
    expect(resumed.state.sessions[0].status).toBe("started");
  });
  it("denies missing, expired, wrong-target and non-member proofs without changing source", async () => {
    const src = await newUser(),
      dst = await member(),
      other = await member(),
      guest = await newUser();
    await completed(src.database);
    const before = await readGame(src.database);
    await expect(claim(dst.id, "a".repeat(64))).rejects.toThrow(
      /Invalid migration proof/,
    );
    const hash = await proof(src.id);
    await expect(claim(guest.id, hash)).rejects.toThrow(/Verified member/);
    await db.query(
      "update public.account_migration_tickets set expires_at=now()-interval '1 minute' where token_hash=$1",
      [hash],
    );
    await expect(claim(dst.id, hash)).rejects.toThrow(/expired/);
    expect(await readGame(src.database)).toEqual(before);
    const fresh = await proof(src.id);
    await claim(dst.id, fresh);
    await expect(claim(other.id, fresh)).rejects.toThrow(/Proof already used/);
    await expect(proof(dst.id)).rejects.toThrow(/Anonymous owner/);
  });
  it("rolls back the merge if a dependent write fails and leaves the proof retryable", async () => {
    const src = await newUser(),
      dst = await member();
    const sessionId = await completed(src.database);
    const hash = await proof(src.id);
    await db.exec(
      "create function public.fail_merge_test() returns trigger language plpgsql as $$begin raise exception 'Injected failure'; end;$$; create trigger fail_merge before update on public.recommendation_feedback for each row execute function public.fail_merge_test();",
    );
    try {
      await expect(claim(dst.id, hash)).rejects.toThrow(/Injected failure/);
    } finally {
      await db.exec(
        "drop trigger fail_merge on public.recommendation_feedback; drop function public.fail_merge_test();",
      );
    }
    expect((await readGame(src.database)).sessions[0].id).toBe(sessionId);
    expect((await readGame(dst.database)).sessions).toHaveLength(0);
    expect(await claim(dst.id, hash)).toBe(1);
  });
  it("revokes ticket access and all migration writes from browser roles", async () => {
    const user = await newUser();
    for (const role of ["anon", "authenticated"] as const) {
      for (const sql of [
        "select * from public.account_migration_tickets",
        `select public.prepare_account_migration('${user.id}','${"a".repeat(64)}')`,
        `select public.claim_account_migration('${user.id}','${"a".repeat(64)}')`,
        `select public.import_local_history('${user.id}','${user.initial.anonymousId}','[]')`,
      ])
        await expect(
          asRole(role, user.id, (tx) => tx.query(sql)),
        ).rejects.toThrow(/permission denied/);
    }
  });
  it("supports parallel proofs for the same target without double transfer and caps pending proofs", async () => {
    const source = await newUser(),
      target = await member();
    await completed(source.database);
    const a = await proof(source.id),
      b = await proof(source.id);
    expect(await claim(target.id, a)).toBe(1);
    expect(await claim(target.id, b)).toBe(0);
    const capped = await newUser();
    for (let index = 0; index < 10; index++) await proof(capped.id);
    await expect(proof(capped.id)).rejects.toThrow(/Too many pending/);
  });
});

describe("untrusted local history import", () => {
  it("imports canonical titles and completion details once, without transferring local EXP", async () => {
    const source = await newUser(),
      dest = await member();
    await completed(source.database);
    const state = await readGame(source.database);
    state.sessions[0].mission.title = "클라이언트가 바꾼 제목";
    state.sessions[0].result!.awardedExp = 999999;
    state.sessions[0].result!.expAfter = 999999;
    const prepared = prepareLocalImport({ state });
    expect(
      await importRecords(dest.id, prepared.sourceId, prepared.records),
    ).toBe(1);
    expect(
      await importRecords(dest.id, prepared.sourceId, prepared.records),
    ).toBe(0);
    const rows = (
      await asRole("authenticated", dest.id, (tx) =>
        tx.query<{ title: string; comment: string; actual_cost: number }>(
          "select title,comment,actual_cost from public.local_mission_history",
        ),
      )
    ).rows;
    expect(rows[0].title).toBe(
      state.sessions[0].mission.title === "클라이언트가 바꾼 제목"
        ? missions.find((m) => m.id === state.sessions[0].mission.id)!.title
        : "",
    );
    expect(rows[0].comment).toBe("가입 전 미션");
    expect(rows[0].actual_cost).toBe(0);
    const exp = (
      await db.query<{ exp: number }>(
        "select exp from public.profiles where id=$1",
        [dest.id],
      )
    ).rows[0].exp;
    expect(exp).toBe(0);
    expect((await readGame(dest.database)).sessions).toHaveLength(0);
  });
  it("isolates imported history and prevents direct browser writes", async () => {
    const a = await member(),
      b = await member();
    await completed(a.database);
    const prepared = prepareLocalImport({ state: await readGame(a.database) });
    await importRecords(a.id, prepared.sourceId, prepared.records);
    expect(
      (
        await asRole("authenticated", b.id, (tx) =>
          tx.query("select * from public.local_mission_history"),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asRole("authenticated", a.id, (tx) =>
        tx.query("delete from public.local_mission_history"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      importRecords((await newUser()).id, prepared.sourceId, prepared.records),
    ).rejects.toThrow(/Member required/);
  });
  it("rolls back the whole import when one record is invalid", async () => {
    const source = await newUser(),
      dst = await member();
    await completed(source.database);
    const prepared = prepareLocalImport({
      state: await readGame(source.database),
    });
    const records = [
      ...prepared.records,
      {
        ...prepared.records[0],
        source_session_id: randomUUID(),
        mission_id: "unknown-mission",
      },
    ];
    await expect(
      importRecords(dst.id, prepared.sourceId, records),
    ).rejects.toThrow(/Unknown mission/);
    expect(
      (
        await db.query(
          "select * from public.local_mission_history where user_id=$1",
          [dst.id],
        )
      ).rows,
    ).toHaveLength(0);
  });
});

async function awards(userId: string): Promise<AchievementUnlock[]> {
  const result = await db.query<AchievementUnlock>(
    `select achievement_id as "achievementId",
    to_char(unlocked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "unlockedAt",
    earned_session_id as "earnedSessionId" from public.user_achievements where user_id=$1 order by achievement_id`,
    [userId],
  );
  return result.rows;
}
async function playTemplate(
  database: GameDatabase,
  mission: Mission,
  relationship: OnboardingAnswers["relationship"] = "solo",
  actualCost: number | null = 0,
) {
  const limited: GameDatabase = {
    ...database,
    missions: async () =>
      (await database.missions()).filter((m) => m.id === mission.id),
  };
  const requested = await run(limited, {
    type: "request",
    answers: {
      relationship,
      durationMinutes: null,
      budgetPerPerson: null,
      travelScope: "anywhere",
      energy: 4,
      intensity: "yolo",
    },
  });
  const sessionId = requested.sessionId!;
  await run(limited, { type: "start", sessionId });
  for (let index = 0; index < mission.steps.length; index++)
    await run(limited, { type: "check", sessionId, index, checked: true });
  await run(limited, {
    type: "complete",
    sessionId,
    input: { actualCost, rating: null, wouldDoAgain: null, comment: "" },
  });
  return sessionId;
}
describe("atomic EXP and database-backed achievements", () => {
  it("publishes nine valid definitions, isolates unlocks and denies all browser award writes", async () => {
    const owner = await newUser(),
      other = await newUser();
    await completed(owner.database);
    expect(
      (
        await asRole("anon", null, (tx) =>
          tx.query("select * from public.achievements"),
        )
      ).rows,
    ).toHaveLength(9);
    expect(
      (
        await asRole("authenticated", other.id, (tx) =>
          tx.query("select * from public.user_achievements"),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asRole("authenticated", owner.id, (tx) =>
          tx.query("select * from public.user_achievements"),
        )
      ).rows,
    ).toHaveLength(1);
    for (const role of ["anon", "authenticated"] as const) {
      for (const sql of [
        "delete from public.achievements",
        "delete from public.user_achievements",
        `select public.award_achievements('${owner.id}')`,
      ])
        await expect(
          asRole(role, owner.id, (tx) => tx.query(sql)),
        ).rejects.toThrow(/permission denied/);
    }
    await expect(
      asRole("service_role", null, (tx) =>
        tx.query("select public.award_achievements($1)", [owner.id]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("records the threshold session and original completion timestamp once across retries", async () => {
    const user = await newUser();
    const id = await completed(user.database);
    const before = await awards(user.id);
    const state = await readGame(user.database);
    expect(before).toEqual([
      {
        achievementId: "first-step",
        earnedSessionId: id,
        unlockedAt: state.sessions[0].completedAt,
      },
    ]);
    await run(user.database, {
      type: "complete",
      sessionId: id,
      input: {
        actualCost: 0,
        rating: 5,
        wouldDoAgain: true,
        comment: "가입 전 미션",
      },
    });
    expect(await awards(user.id)).toEqual(before);
    expect(
      (
        await db.query<{ exp: number }>(
          "select exp from public.profiles where id=$1",
          [user.id],
        )
      ).rows[0].exp,
    ).toBe(state.sessions[0].result!.awardedExp);
  });
  it("agrees with offline rules for counts, companions, zero costs, outdoors and distinct categories", async () => {
    const user = await newUser();
    const samples: [Mission, OnboardingAnswers["relationship"]][] = [
      [
        missions.find(
          (m) => m.outdoor && m.allowedRelationships.includes("solo"),
        )!,
        "solo",
      ],
      [
        missions.find(
          (m) =>
            m.category === "home" && m.allowedRelationships.includes("solo"),
        )!,
        "solo",
      ],
      [
        missions.find(
          (m) =>
            m.category === "creative" &&
            m.allowedRelationships.includes("family"),
        )!,
        "family",
      ],
      [
        missions.find(
          (m) =>
            m.category === "date" && m.allowedRelationships.includes("couple"),
        )!,
        "couple",
      ],
      [
        missions.find(
          (m) =>
            m.category === "food" && m.allowedRelationships.includes("friend"),
        )!,
        "friend",
      ],
    ];
    for (const [mission, relationship] of samples)
      await playTemplate(user.database, mission, relationship);
    for (let i = 0; i < 2; i++) {
      await playTemplate(user.database, samples[1][0]);
      await playTemplate(user.database, samples[4][0], "friend");
    }
    const actual = await awards(user.id);
    const predicted = localProgression(
      await readGame(user.database),
      achievements,
    ).unlocks.toSorted((a, b) =>
      a.achievementId.localeCompare(b.achievementId),
    );
    expect(actual).toEqual(predicted);
    expect(actual.map((a) => a.achievementId)).toEqual(
      expect.arrayContaining([
        "first-step",
        "out-the-door",
        "home-player",
        "snack-sommelier",
        "friend-adventurer",
        "date-rescuer",
        "family-memory",
        "zero-budget",
        "curious-player",
      ]),
    );
  });
  it("leaves missing costs neutral and never awards titles for imported local archives", async () => {
    const user = await newUser(),
      memberUser = await member();
    const template = missions.find(
      (m) => m.category === "home" && m.allowedRelationships.includes("solo"),
    )!;
    await playTemplate(user.database, template, "solo", null);
    for (let i = 0; i < 2; i++) await playTemplate(user.database, template);
    expect(
      (await awards(user.id)).some((a) => a.achievementId === "zero-budget"),
    ).toBe(false);
    const prepared = prepareLocalImport({
      state: await readGame(user.database),
    });
    await importRecords(memberUser.id, prepared.sourceId, prepared.records);
    expect(await awards(memberUser.id)).toHaveLength(0);
    await playTemplate(user.database, template);
    expect(
      (await awards(user.id)).some((a) => a.achievementId === "zero-budget"),
    ).toBe(true);
  });
  it("rolls back completion, feedback, EXP and titles together when award storage fails", async () => {
    const user = await newUser(),
      sessionId = await checked(user.database);
    const before = await readGame(user.database);
    await db.exec(
      "create function public.fail_award_test() returns trigger language plpgsql as $$begin raise exception 'Award failure'; end;$$; create trigger fail_award before insert on public.user_achievements for each row execute function public.fail_award_test();",
    );
    try {
      await expect(
        run(user.database, {
          type: "complete",
          sessionId,
          input: {
            actualCost: null,
            rating: null,
            wouldDoAgain: null,
            comment: "",
          },
        }),
      ).rejects.toThrow(/Award failure/);
    } finally {
      await db.exec(
        "drop trigger fail_award on public.user_achievements; drop function public.fail_award_test();",
      );
    }
    expect(await readGame(user.database)).toEqual(before);
    expect(await awards(user.id)).toHaveLength(0);
    await completedAfterChecks(user.database, sessionId);
    expect(await awards(user.id)).toHaveLength(1);
  });
  it("backfills pre-existing completions with their historical dates and preserves awarded EXP", async () => {
    const user = await newUser();
    let id: string;
    await db.exec(
      "alter table public.mission_sessions disable trigger session_achievement_award",
    );
    try {
      id = await completed(user.database);
    } finally {
      await db.exec(
        "alter table public.mission_sessions enable trigger session_achievement_award",
      );
    }
    const before = await readGame(user.database);
    expect(await awards(user.id)).toHaveLength(0);
    await db.exec(progressionSeedSql);
    expect(await awards(user.id)).toEqual([
      {
        achievementId: "first-step",
        earnedSessionId: id!,
        unlockedAt: before.sessions[0].completedAt,
      },
    ]);
    expect(await readGame(user.database)).toEqual(before);
    await db.exec(progressionSeedSql);
    expect(await awards(user.id)).toHaveLength(1);
  });
  it("rechecks merged history, combining milestones while retaining one title per owner", async () => {
    const source = await newUser(),
      target = await member();
    await completed(source.database);
    await completed(source.database);
    await completed(target.database);
    expect(
      (await awards(source.id)).some((a) => a.achievementId === "zero-budget"),
    ).toBe(false);
    const hash = await proof(source.id);
    await claim(target.id, hash);
    const merged = await readGame(target.database);
    expect(await awards(target.id)).toEqual(
      localProgression(merged, achievements).unlocks.toSorted((a, b) =>
        a.achievementId.localeCompare(b.achievementId),
      ),
    );
    expect(
      (await awards(target.id)).filter((a) => a.achievementId === "first-step"),
    ).toHaveLength(1);
    expect(
      (await awards(target.id)).some((a) => a.achievementId === "zero-budget"),
    ).toBe(true);
    await claim(target.id, hash);
    expect(await awards(target.id)).toHaveLength(2);
  });
  it("supports a new DB rule without UI logic changes and rejects malformed rule values", async () => {
    const user = await newUser();
    const custom = {
      ...achievements[0],
      id: "two-completions",
      conditionValue: { target: 2, filter: {} },
    };
    await db.query(
      "insert into public.achievements(id,name,emoji,description,condition_type,condition_value) values($1,$2,$3,$4,$5,$6)",
      [
        custom.id,
        custom.name,
        custom.emoji,
        custom.description,
        custom.conditionType,
        JSON.stringify(custom.conditionValue),
      ],
    );
    try {
      await completed(user.database);
      expect(
        (await awards(user.id)).some((a) => a.achievementId === custom.id),
      ).toBe(false);
      // JSON may spell a valid integer as 2.0; SQL and TypeScript must agree.
      await db.query(
        'update public.achievements set condition_value=\'{"target":2.0,"filter":{}}\'::jsonb where id=$1',
        [custom.id],
      );
      await completed(user.database);
      expect(
        (await awards(user.id)).find((a) => a.achievementId === custom.id),
      ).toEqual(
        localProgression(await readGame(user.database), [custom]).unlocks[0],
      );
      for (const filter of [
        { unknown: true },
        { outdoor: "yes" },
        { category: null },
      ])
        await expect(
          db.query(
            "update public.achievements set condition_value=$2 where id=$1",
            [custom.id, JSON.stringify({ target: 2, filter })],
          ),
        ).rejects.toThrow(/achievement_rule_value/);
    } finally {
      await db.query(
        "delete from public.user_achievements where achievement_id=$1",
        [custom.id],
      );
      await db.query("delete from public.achievements where id=$1", [
        custom.id,
      ]);
    }
  });
  it("keeps a recommended reward fixed if the live catalog changes before completion", async () => {
    const user = await newUser();
    const mission = missions.find((m) => m.difficulty === 2)!;
    const limited: GameDatabase = {
      ...user.database,
      missions: async () =>
        (await user.database.missions()).filter((m) => m.id === mission.id),
    };
    const requested = await run(limited, {
      type: "request",
      answers: {
        relationship: mission.allowedRelationships[0],
        durationMinutes: null,
        budgetPerPerson: null,
        travelScope: "anywhere",
        energy: 4,
        intensity: "yolo",
      },
    });
    const id = requested.sessionId!;
    expect(requested.state.sessions[0].mission.baseExp).toBe(120);
    await db.query(
      "update public.missions set template=jsonb_set(template,'{baseExp}','180') where id=$1",
      [mission.id],
    );
    try {
      await run(limited, { type: "start", sessionId: id });
      for (let index = 0; index < mission.steps.length; index++)
        await run(limited, {
          type: "check",
          sessionId: id,
          index,
          checked: true,
        });
      await completedAfterChecks(limited, id);
      expect((await readGame(limited)).sessions[0].result!.awardedExp).toBe(
        120,
      );
    } finally {
      await db.query("update public.missions set template=$2 where id=$1", [
        mission.id,
        JSON.stringify(mission),
      ]);
    }
  });
});
async function completedAfterChecks(database: GameDatabase, sessionId: string) {
  await run(database, {
    type: "complete",
    sessionId,
    input: { actualCost: null, rating: null, wouldDoAgain: null, comment: "" },
  });
}

const auditContext: AnalyticsContext = {
  visitId: randomUUID(),
  timeZone: "Asia/Seoul",
};
const auditRun = (
  database: GameDatabase,
  command: GameCommand,
  context = auditContext,
) => executeGame(database, command, "Asia/Seoul", now, context);
async function auditChecked(database: GameDatabase, context = auditContext) {
  const requested = await auditRun(
      database,
      { type: "request", answers },
      context,
    ),
    id = requested.sessionId!;
  await auditRun(database, { type: "start", sessionId: id }, context);
  for (
    let index = 0;
    index < requested.state.sessions[0].mission.steps.length;
    index++
  )
    await auditRun(
      database,
      { type: "check", sessionId: id, index, checked: true },
      context,
    );
  return id;
}
async function auditCompleted(database: GameDatabase, context = auditContext) {
  const id = await auditChecked(database, context);
  await auditRun(
    database,
    {
      type: "complete",
      sessionId: id,
      input: {
        actualCost: 0,
        rating: 5,
        wouldDoAgain: true,
        comment: "private result comment",
      },
    },
    context,
  );
  return id;
}
async function eventRows(userId: string): Promise<AnalyticsEvent[]> {
  const rows = await db.query<{ event: unknown }>(
    `select jsonb_build_object(
    'id',id,'name',name,'visitId',visit_id,'anonymousId',anonymous_id,'timeZone',time_zone,
    'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'localDate',to_char(local_date,'YYYY-MM-DD'),'sessionId',session_id,'recommendationRunId',recommendation_run_id,
    'missionId',mission_id,'dedupeKey',dedupe_key,'source',source,'properties',properties) as event
    from public.analytics_events where user_id=$1 order by occurred_at,dedupe_key`,
    [userId],
  );
  return rows.rows.map((r) => analyticsEventSchema.parse(r.event));
}
const ingest = (owner: string, anon: string, events: unknown) =>
  asRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx.query<{ added: number }>(
          "select public.record_client_events($1,$2,$3::jsonb) as added",
          [owner, anon, JSON.stringify(events)],
        )
      ).rows[0].added,
  );
const clientFact = (
  name: ClientEvent["name"] = "visit_started",
  options: Partial<ClientEvent> = {},
) =>
  makeClientEvent(
    { name, sessionId: null, properties: {}, ...options },
    auditContext,
    new Date(),
    randomUUID,
  );

describe("private behavioral analytics", () => {
  it("records game lifecycle facts exactly once alongside successful writes", async () => {
    const user = await newUser(),
      before = user.initial;
    const id = await auditCompleted(user.database),
      state = await readGame(user.database);
    const rows = await eventRows(user.id);
    expect(rows.map((e) => e.name).sort()).toEqual([
      "mission_accepted",
      "mission_completed",
      "mission_shown",
      "mission_started",
    ]);
    const omitId = (event: AnalyticsEvent) => {
      const { id, ...rest } = event;
      expect(id).toBeDefined();
      return rest;
    };
    expect(
      rows.map(omitId).toSorted((a, b) => a.name.localeCompare(b.name)),
    ).toEqual(
      gameAnalytics(before, state, auditContext, randomUUID)
        .map(omitId)
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    );
    await auditRun(user.database, {
      type: "complete",
      sessionId: id,
      input: {
        actualCost: 0,
        rating: 5,
        wouldDoAgain: true,
        comment: "private result comment",
      },
    });
    expect(await eventRows(user.id)).toEqual(rows);
    expect(JSON.stringify(rows)).not.toContain("private result comment");
    expect(JSON.stringify(rows)).not.toContain("actualCost");
  });
  it("records rerolls and rejection reasons, with no false completion after abandonment", async () => {
    const user = await newUser();
    const a = await auditRun(user.database, { type: "request", answers });
    const b = await auditRun(user.database, {
      type: "reroll",
      sessionId: a.sessionId!,
      reason: "too_far",
    });
    await auditRun(user.database, {
      type: "reroll",
      sessionId: a.sessionId!,
      reason: "too_far",
    });
    await auditRun(user.database, { type: "start", sessionId: b.sessionId! });
    await auditRun(user.database, { type: "abandon", sessionId: b.sessionId! });
    const rows = await eventRows(user.id);
    expect(rows).toHaveLength(6);
    expect(rows.find((e) => e.name === "mission_rejected")!.properties).toEqual(
      { reason: "too_far", rerollIndex: 0 },
    );
    expect(rows.some((e) => e.name === "mission_completed")).toBe(false);
    expect(new Set(rows.map((e) => e.recommendationRunId)).size).toBe(1);
    const report = analyticsReport(
      rows.map((event) => ({ ownerId: user.id, event })),
    );
    expect(report.rerolls.total).toBe(1);
    expect(report.funnel).toMatchObject({
      shown: 2,
      accepted: 1,
      completed: 0,
    });
  });
  it("rolls back lifecycle events if a later game write fails", async () => {
    const user = await newUser(),
      stored = storedGameSchema.parse(await user.database.read());
    const capture: GameDatabase = { ...user.database, commit: async () => {} };
    const proposed = await auditRun(capture, { type: "request", answers });
    proposed.state.feedback[0].missionId = "nonexistent";
    await expect(
      user.database.commit(stored.revision, proposed.state, auditContext),
    ).rejects.toThrow(/Invalid feedback/);
    expect(await eventRows(user.id)).toHaveLength(0);
    expect(await readGame(user.database)).toEqual(stored.state);
  });
  it("does not let an analytics-only storage failure stop mission completion or EXP", async () => {
    const user = await newUser();
    await db.exec(
      "create function public.fail_analytics_test() returns trigger language plpgsql as $$begin raise exception 'Telemetry failure'; end;$$; create trigger fail_analytics before insert on public.analytics_events for each row execute function public.fail_analytics_test();",
    );
    let id: string;
    try {
      id = await auditCompleted(user.database);
    } finally {
      await db.exec(
        "drop trigger fail_analytics on public.analytics_events; drop function public.fail_analytics_test();",
      );
    }
    const state = await readGame(user.database);
    expect(state.sessions.find((s) => s.id === id!)!.status).toBe("completed");
    expect(state.sessions[0].result!.awardedExp).toBeGreaterThan(0);
    expect(await awards(user.id)).toHaveLength(1);
    expect(await eventRows(user.id)).toHaveLength(0);
  });
  it("computes lifecycle calendar dates using the visit zone at a midnight boundary", async () => {
    const user = await newUser();
    const shown = await executeGame(
      user.database,
      { type: "request", answers },
      "UTC",
      () => new Date("2026-10-06T14:59:00Z"),
      auditContext,
    );
    await executeGame(
      user.database,
      { type: "start", sessionId: shown.sessionId! },
      "UTC",
      () => new Date("2026-10-06T15:01:00Z"),
      auditContext,
    );
    const rows = await eventRows(user.id);
    expect(rows.find((e) => e.name === "mission_shown")!.localDate).toBe(
      "2026-10-06",
    );
    expect(rows.find((e) => e.name === "mission_started")!.localDate).toBe(
      "2026-10-07",
    );
  });
  it("accepts owned visit events once and protects personal event rows with RLS", async () => {
    const user = await newUser(),
      other = await newUser(),
      event = clientFact();
    expect(await ingest(user.id, user.initial.anonymousId, [event])).toBe(1);
    expect(
      await ingest(user.id, user.initial.anonymousId, [
        { ...event, id: randomUUID() },
      ]),
    ).toBe(0);
    expect(
      (
        await asRole("authenticated", user.id, (tx) =>
          tx.query("select name from public.analytics_events"),
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await asRole("authenticated", other.id, (tx) =>
          tx.query("select name from public.analytics_events"),
        )
      ).rows,
    ).toHaveLength(0);
    for (const role of ["anon", "authenticated"] as const) {
      for (const sql of [
        "delete from public.analytics_events",
        `select public.record_client_events('${user.id}','${user.initial.anonymousId}','[]')`,
        `select public.commit_game_state('${user.id}',0,'{}','{}')`,
      ])
        await expect(
          asRole(role, user.id, (tx) => tx.query(sql)),
        ).rejects.toThrow(/permission denied/);
    }
  });
  it("rejects client lifecycle claims, personal fields, stale times and forged owners", async () => {
    const user = await newUser(),
      event = clientFact();
    for (const invalid of [
      { ...event, name: "mission_completed" },
      { ...event, properties: { comment: "private" } },
      { ...event, actualCost: 5 },
      { ...event, timeZone: "Fake/Zone" },
      { ...event, occurredAt: "2000-01-01T00:00:00Z" },
    ])
      await expect(
        ingest(user.id, user.initial.anonymousId, [invalid]),
      ).rejects.toThrow();
    await expect(ingest(user.id, randomUUID(), [event])).rejects.toThrow(
      /Invalid event owner/,
    );
    expect(await eventRows(user.id)).toHaveLength(0);
  });
  it("requires an owned completed mission for successful sharing and derives linkage from DB", async () => {
    const user = await newUser(),
      other = await newUser();
    const id = await auditCompleted(user.database);
    const shared = clientFact("mission_shared", {
      sessionId: id,
      properties: { channel: "clipboard" },
    });
    await expect(
      ingest(other.id, other.initial.anonymousId, [shared]),
    ).rejects.toThrow(/Invalid session owner/);
    await ingest(user.id, user.initial.anonymousId, [shared]);
    const row = (await eventRows(user.id)).find(
      (e) => e.name === "mission_shared",
    )!;
    expect(row.missionId).toBe(
      (await readGame(user.database)).sessions[0].mission.id,
    );
    expect(row.recommendationRunId).toBe(
      (await readGame(user.database)).sessions[0].recommendationRunId,
    );
    const active = await auditRun(user.database, { type: "request", answers });
    await expect(
      ingest(user.id, user.initial.anonymousId, [
        { ...shared, id: randomUUID(), sessionId: active.sessionId },
      ]),
    ).rejects.toThrow(/Completed session required/);
  });
  it("rolls back an entire bad batch and safely acknowledges replayed delivered events", async () => {
    const user = await newUser(),
      event = clientFact("landing_view");
    await expect(
      ingest(user.id, user.initial.anonymousId, [
        event,
        { ...event, id: randomUUID(), name: "mission_completed" },
      ]),
    ).rejects.toThrow();
    expect(await eventRows(user.id)).toHaveLength(0);
    expect(
      await ingest(user.id, user.initial.anonymousId, [event, event]),
    ).toBe(1);
    expect(await ingest(user.id, user.initial.anonymousId, [event])).toBe(0);
    expect(await eventRows(user.id)).toHaveLength(1);
  });
  it("stitches committed anonymous analytics on account merge, coalescing a shared visit key", async () => {
    const source = await newUser(),
      target = await member();
    const event = clientFact();
    await ingest(source.id, source.initial.anonymousId, [
      { ...event, occurredAt: new Date(Date.now() - 60000).toISOString() },
    ]);
    await ingest(target.id, target.initial.anonymousId, [
      { ...event, id: randomUUID() },
    ]);
    const sessionId = await auditCompleted(source.database);
    const hash = await proof(source.id);
    await claim(target.id, hash);
    expect(await eventRows(source.id)).toHaveLength(0);
    const rows = await eventRows(target.id);
    expect(rows).toHaveLength(5);
    expect(rows.filter((e) => e.name === "visit_started")).toHaveLength(1);
    expect(rows.find((e) => e.name === "mission_completed")!.sessionId).toBe(
      sessionId,
    );
    expect(rows.find((e) => e.name === "visit_started")!.anonymousId).toBe(
      source.initial.anonymousId,
    );
    expect(
      analyticsReport(rows.map((event) => ({ ownerId: target.id, event })))
        .visits.visitors,
    ).toBe(1);
    await claim(target.id, hash);
    expect(await eventRows(target.id)).toEqual(rows);
    await expect(
      ingest(source.id, source.initial.anonymousId, [clientFact()]),
    ).rejects.toThrow(/Invalid event owner/);
  });
  it("keeps analytics with the source if account migration fails and succeeds on retry", async () => {
    const source = await newUser(),
      target = await member();
    await auditCompleted(source.database);
    const before = await eventRows(source.id),
      hash = await proof(source.id);
    await db.exec(
      "create function public.fail_audit_merge() returns trigger language plpgsql as $$begin raise exception 'Audit merge failure'; end;$$; create trigger fail_audit_merge before update on public.recommendation_feedback for each row execute function public.fail_audit_merge();",
    );
    try {
      await expect(claim(target.id, hash)).rejects.toThrow(
        /Audit merge failure/,
      );
    } finally {
      await db.exec(
        "drop trigger fail_audit_merge on public.recommendation_feedback; drop function public.fail_audit_merge();",
      );
    }
    expect(await eventRows(source.id)).toEqual(before);
    expect(await eventRows(target.id)).toHaveLength(0);
    await claim(target.id, hash);
    expect(await eventRows(target.id)).toEqual(before);
  });
  it("keeps private emitter functions inaccessible even to the server API role", async () => {
    for (const name of [
      "on_session_analytics()",
      "on_rejection_analytics()",
      "commit_game_state_v2(uuid,bigint,jsonb)",
      "claim_account_migration_v1(uuid,text)",
      "emit_game_analytics(public.mission_sessions,text,timestamptz,jsonb,jsonb)",
    ]) {
      const result = await db.query<{ allowed: boolean }>(
        "select has_function_privilege('service_role',$1,'execute') as allowed",
        [`public.${name}`],
      );
      expect(result.rows[0].allowed).toBe(false);
    }
  });
});
