import { EXP_PER_LEVEL } from "@/lib/progression/experience";
import { profileSummary } from "@/services/profileService";
import type { LocalState } from "@/types/game";

export function LevelProgress({ state }: { state: LocalState }) {
  const profile = profileSummary(state);
  return (
    <div className="mt-6 rounded-[28px] bg-lime p-6 shadow-[3px_3px_0_#242622]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold">PLAYER LEVEL</p>
          <strong className="mt-2 block text-5xl font-black tracking-tighter">
            LV.{profile.level}
          </strong>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold">
            완료한 미션 <strong>{profile.completedCount}개</strong>
          </p>
          <p className="mt-2 font-mono text-sm font-bold">
            {profile.exp.toLocaleString("ko-KR")} EXP
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="다음 레벨까지 경험치"
        aria-valuemin={0}
        aria-valuemax={EXP_PER_LEVEL}
        aria-valuenow={profile.levelExp}
        className="mt-5 h-3 overflow-hidden rounded-full bg-white/70"
      >
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${(profile.levelExp / EXP_PER_LEVEL) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[11px] font-semibold">
        <span>
          {profile.levelExp} / {EXP_PER_LEVEL} EXP
        </span>
        <span>다음 레벨까지 {profile.nextLevelExp} EXP</span>
      </div>
    </div>
  );
}
