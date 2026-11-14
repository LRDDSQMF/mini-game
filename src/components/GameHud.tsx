import { Pause, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  isMuted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

export function GameHud({ hud, isMuted, onPause, onToggleMute }: GameHudProps) {
  const stageSpan = Math.max(1, hud.stageTargetLayer - hud.stageStartLayer);
  const stageDone = Math.max(0, hud.layers - hud.stageStartLayer);
  const progressPct = Math.min(100, Math.round((stageDone / stageSpan) * 100));

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3.5 sm:p-5"
      style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
    >
      {/* Top Perimeter HUD Row */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Unboxed Stage Progress & Layer Counter */}
        <div className="min-w-0 max-w-[58%] sm:max-w-[260px]">
          <div className="flex items-baseline gap-1.5 text-xs sm:text-sm font-bold text-[#5C3D2E] truncate">
            <span>關卡 {hud.stageNumber}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{hud.stageName}</span>
          </div>
          <div className="mt-1 flex items-center gap-2.5">
            <div className="w-28 sm:w-36 h-2.5 rounded-full bg-[#FFFDF9] border-2 border-[#5C3D2E] overflow-hidden">
              <div
                className="h-full bg-[#FF4D6D] transition-transform duration-200 ease-out origin-left"
                style={{ transform: `scaleX(${progressPct / 100})` }}
              />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#5C3D2E] tabular-nums whitespace-nowrap shrink-0">
              {hud.layers} / {hud.stageTargetLayer} 層
            </span>
          </div>
        </div>

        {/* Top-Right: Score + Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="text-right mr-1">
            <div className="font-display text-2xl sm:text-3xl font-bold leading-none text-[#5C3D2E] tabular-nums">
              {hud.score.toLocaleString()}
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-[#5C3D2E]/75 tabular-nums mt-0.5 whitespace-nowrap">
              {hud.combo >= 2 ? (
                <span className="text-[#D97706]">連擊 ×{hud.combo}</span>
              ) : (
                <span>最佳 {hud.bestLayers} 層</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            aria-label={isMuted ? '開啟音效' : '靜音'}
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-[#FFFDF9] border-2 border-b-4 border-[#5C3D2E] text-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D6D]"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
            aria-label="暫停遊戲"
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-[#FFFDF9] border-2 border-b-4 border-[#5C3D2E] text-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D6D]"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Non-Blocking Stage Clear Toast */}
      {hud.stageClearBanner && (
        <div className="mx-auto mt-3 px-5 py-2.5 rounded-2xl bg-[#FFFDF9] border-2 border-b-[5px] border-[#5C3D2E] text-center max-w-[90vw]">
          <div className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-bold text-[#FF4D6D]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{hud.stageClearBanner.stageName} 達成!</span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#5C3D2E] mt-0.5 tabular-nums">
            裝飾「{hud.stageClearBanner.decorationName}」已放上
            {hud.stageClearBanner.widthBonus > 0
              ? ` · 蛋糕加寬 +${hud.stageClearBanner.widthBonus}`
              : ''}
          </p>
        </div>
      )}

      {/* Quiet bottom helper only on layer 0 before first drop */}
      <div className="text-center pb-2">
        {hud.layers === 0 && (
          <p className="text-xs sm:text-sm font-bold text-[#5C3D2E]/75">
            點擊任意處放下第一層蛋糕
          </p>
        )}
      </div>
    </div>
  );
}
