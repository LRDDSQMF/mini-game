import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal } from './components/GameModals';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './game/audio';
import { CakeGameEngine, loadSavedRecords } from './game/engine';
import { BASE_STAGES } from './game/stages';
import { GameState, HudSnapshot } from './game/types';

function createInitialHud(): HudSnapshot {
  const records = loadSavedRecords();
  return {
    score: 0,
    layers: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    stageNumber: 1,
    stageName: BASE_STAGES[0].name,
    stageStartLayer: 0,
    stageTargetLayer: BASE_STAGES[0].targetLayers,
    bestLayers: records.bestLayers,
    bestScore: records.bestScore,
    isNewRecord: false,
    stageClearBanner: null,
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CakeGameEngine | null>(null);
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const gameOverAtRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [hud, setHud] = useState<HudSnapshot>(createInitialHud);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.isMuted());

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new CakeGameEngine(canvas, {
      onStateChange: (nextState) => {
        gameStateRef.current = nextState;
        if (nextState === 'GAME_OVER') {
          gameOverAtRef.current = performance.now();
        }
        setGameState(nextState);
      },
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    const handleBlur = () => {
      if (gameStateRef.current === 'PLAYING') {
        engine.pauseGame();
      }
    };
    const handleFocus = () => {
      if (!document.hidden) {
        soundEngine.handleVisibilityChange(false);
      }
    };
    const handleVisibility = () => {
      soundEngine.handleVisibilityChange(document.hidden);
      if (document.hidden && gameStateRef.current === 'PLAYING') {
        engine.pauseGame();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      soundEngine.stopBgm();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleReturnHome = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  const handleStagePointerDown = useCallback(() => {
    soundEngine.unlock();
    if (gameStateRef.current === 'TITLE_MENU' && !soundEngine.isMuted()) {
      soundEngine.setBgmMode('title');
      soundEngine.startBgm();
    } else if (gameStateRef.current === 'PLAYING') {
      engineRef.current?.handlePrimaryAction();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === 'm') {
        handleToggleMute();
        return;
      }

      if (key === 'p' || e.key === 'Escape') {
        if (gameStateRef.current === 'PLAYING') {
          engineRef.current?.pauseGame();
        } else if (gameStateRef.current === 'PAUSED') {
          engineRef.current?.resumeGame();
        }
        return;
      }

      if (e.code === 'Space' || e.key === 'Enter') {
        if (gameStateRef.current === 'TITLE_MENU') {
          e.preventDefault();
          engineRef.current?.startNewGame();
        } else if (gameStateRef.current === 'PLAYING') {
          e.preventDefault();
          engineRef.current?.handlePrimaryAction();
        } else if (
          gameStateRef.current === 'GAME_OVER' &&
          performance.now() - gameOverAtRef.current > 400
        ) {
          e.preventDefault();
          engineRef.current?.startNewGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMute]);

  return (
    <main
      className="relative w-full h-[100dvh] overflow-hidden bg-[#FFF9F2] select-none"
      onPointerDown={handleStagePointerDown}
    >
      {/* Isolated 60fps Canvas Container */}
      <div className="absolute inset-0 w-full h-full">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* State-Driven Overlays */}
      {gameState === 'TITLE_MENU' && (
        <TitleOverlay
          hud={hud}
          isMuted={isMuted}
          onStart={handleStart}
          onToggleMute={handleToggleMute}
        />
      )}

      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <GameHud
          hud={hud}
          isMuted={isMuted}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
        />
      )}

      {gameState === 'PAUSED' && (
        <PauseModal
          hud={hud}
          onResume={handleResume}
          onRestart={handleStart}
          onHome={handleReturnHome}
        />
      )}

      {gameState === 'GAME_OVER' && (
        <GameOverModal
          hud={hud}
          onRestart={handleStart}
          onHome={handleReturnHome}
        />
      )}
    </main>
  );
}
