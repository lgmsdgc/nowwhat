import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  LocalRepository,
  STORAGE_KEY,
  type StoragePort,
} from "@/lib/repositories/localRepository";
import { missions } from "@/seed/missions";

class MemoryStorage implements StoragePort {
  records = new Map<string, string>();
  fail = false;
  getItem(key: string) {
    return this.records.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error("quota");
    this.records.set(key, value);
  }
}
const env = () => ({
  now: new Date(),
  id: randomUUID,
  random: () => 0,
  missions,
});

describe("versioned local repository", () => {
  it("creates one anonymous ID and restores answers/step on a new instance", () => {
    const storage = new MemoryStorage();
    const repo = new LocalRepository(storage);
    const first = repo.initialize(env());
    repo.execute({ type: "answer", key: "budgetPerPerson", value: 0 }, env());
    repo.execute({ type: "step", step: 2 }, env());
    const restored = new LocalRepository(storage).initialize(env());
    expect(restored.anonymousId).toBe(first.anonymousId);
    expect(restored.onboarding).toEqual({
      answers: { budgetPerPerson: 0 },
      step: 2,
    });
  });
  it("rereads current storage for each mutation so another instance does not overwrite progress", () => {
    const storage = new MemoryStorage();
    const a = new LocalRepository(storage);
    const b = new LocalRepository(storage);
    a.initialize(env());
    b.initialize(env());
    a.execute({ type: "answer", key: "relationship", value: "solo" }, env());
    b.execute({ type: "answer", key: "budgetPerPerson", value: 0 }, env());
    expect(a.read()?.onboarding.answers).toEqual({
      relationship: "solo",
      budgetPerPerson: 0,
    });
  });
  it("does not alter previous data when a write fails", () => {
    const storage = new MemoryStorage();
    const repo = new LocalRepository(storage);
    repo.initialize(env());
    const previous = storage.getItem(STORAGE_KEY);
    storage.fail = true;
    expect(() => repo.execute({ type: "step", step: 3 }, env())).toThrow(
      "저장하지 못했어요",
    );
    expect(storage.getItem(STORAGE_KEY)).toBe(previous);
  });
  it("does not silently clear malformed or unknown-version records", () => {
    for (const raw of ["bad json", '{"version":1}', '{"version":2}']) {
      const storage = new MemoryStorage();
      storage.setItem(STORAGE_KEY, raw);
      expect(() => new LocalRepository(storage).initialize(env())).toThrow();
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    }
  });
  it("backs up corrupted bytes before starting over", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "broken");
    const repo = new LocalRepository(storage);
    const restored = repo.recover(env());
    expect(restored.sessions).toEqual([]);
    expect(
      [...storage.records.entries()].some(
        ([key, value]) =>
          key.startsWith(`${STORAGE_KEY}:backup:`) && value === "broken",
      ),
    ).toBe(true);
    expect(repo.read()?.anonymousId).toBe(restored.anonymousId);
  });
  it("never overwrites a newer version or resets when backup fails", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{"version":2}');
    const repo = new LocalRepository(storage);
    expect(() => repo.recover(env())).toThrow("다른 버전");
    storage.setItem(STORAGE_KEY, "broken");
    storage.fail = true;
    expect(() => repo.recover(env())).toThrow("백업하지 못해");
    expect(storage.getItem(STORAGE_KEY)).toBe("broken");
  });
  it("rejects invalid user input without changing the stored answers", () => {
    const storage = new MemoryStorage();
    const repo = new LocalRepository(storage);
    repo.initialize(env());
    expect(() =>
      repo.execute({ type: "answer", key: "energy", value: 99 }, env()),
    ).toThrow();
    expect(repo.read()?.onboarding.answers).toEqual({});
  });
});
