import { Award, Home, Play, RotateCcw } from 'lucide-react';
import { getPatissierRank } from '../game/stages';
import { HudSnapshot } from '../game/types';

interface PauseModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export function PauseModal({ hud, onResume, onRestart, onHome }: PauseModalProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-[#5C3D2E]/35"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[340px] bg-[#FFFDF9] border-2 border-b-[6px] border-[#5C3D2E] rounded-3xl p-6 text-center">
        <h2 className="font-display text-2xl font-bold text-[#5C3D2E]">暫停休息中</h2>
        <p className="mt-1.5 text-sm font-bold text-[#5C3D2E]/75 tabular-nums">
          目前 {hud.layers} 層 · {hud.score.toLocaleString()} 分
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="min-h-[48px] w-full px-5 py-2.5 rounded-2xl bg-[#FF4D6D] hover:bg-[#F53B5C] text-[#FFFDF9] font-bold text-base border-2 border-b-[5px] border-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>繼續遊戲</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="min-h-[46px] w-full px-5 py-2.5 rounded-2xl bg-[#FFE082] hover:bg-[#FFD54F] text-[#5C3D2E] font-bold text-base border-2 border-b-[5px] border-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重新開始</span>
          </button>

          <button
            type="button"
            onClick={onHome}
            className="min-h-[46px] w-full px-5 py-2.5 rounded-2xl bg-[#FFF9F2] hover:bg-[#FFE8D6] text-[#5C3D2E] font-bold text-base border-2 border-b-[5px] border-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>返回主頁</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  hud: HudSnapshot;
  onRestart: () => void;
  onHome: () => void;
}

export function GameOverModal({ hud, onRestart, onHome }: GameOverModalProps) {
  const rank = getPatissierRank(hud.layers);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-[#5C3D2E]/35"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[360px] bg-[#FFFDF9] border-2 border-b-[6px] border-[#5C3D2E] rounded-3xl p-6 text-center">
        {hud.isNewRecord && (
          <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#D97706] mb-1">
            <Award className="w-4 h-4" />
            <span>刷新最高紀錄!</span>
          </div>
        )}

        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#5C3D2E]">
          烘焙完成
        </h2>
        <p className="mt-1 text-sm font-bold text-[#FF4D6D]">{rank}</p>

        {/* Clean Hairline-Divided Summary Metrics (No Nested Cards) */}
        <div className="mt-5 py-4 border-y border-[#5C3D2E]/15 grid grid-cols-3 gap-2">
          <div>
            <div className="text-xs font-bold text-[#5C3D2E]/65">堆疊高度</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#5C3D2E] tabular-nums">
              {hud.layers} 層
            </div>
          </div>
          <div className="border-x border-[#5C3D2E]/15 px-1">
            <div className="text-xs font-bold text-[#5C3D2E]/65">總分</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#5C3D2E] tabular-nums">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-[#5C3D2E]/65">最高連擊</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#5C3D2E] tabular-nums">
              ×{hud.maxCombo}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs sm:text-sm font-bold text-[#5C3D2E]/75 tabular-nums">
          歷史最佳 {hud.bestLayers} 層 <span aria-hidden="true">·</span> 完美對齊 {hud.perfectCount} 次
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[50px] w-full px-6 py-3 rounded-2xl bg-[#FF4D6D] hover:bg-[#F53B5C] text-[#FFFDF9] font-bold text-lg border-2 border-b-[5px] border-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>再玩一次</span>
          </button>

          <button
            type="button"
            onClick={onHome}
            className="min-h-[44px] w-full px-5 py-2 rounded-2xl bg-[#FFF9F2] hover:bg-[#FFE8D6] text-[#5C3D2E] font-bold text-sm border-2 border-b-4 border-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>返回主頁</span>
          </button>
        </div>
      </div>
    </div>
  );
}
