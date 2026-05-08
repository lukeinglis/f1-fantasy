"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/* Team colours (inline to keep the component self-contained)         */
/* ------------------------------------------------------------------ */
const TEAM_PALETTE = [
  { color: "#3671C6", label: "RBR" },
  { color: "#E8002D", label: "FER" },
  { color: "#27F4D2", label: "MER" },
  { color: "#FF8000", label: "MCL" },
  { color: "#229971", label: "AMR" },
  { color: "#0093CC", label: "ALP" },
  { color: "#64C4FF", label: "WIL" },
  { color: "#6692FF", label: "RB" },
  { color: "#B6BABD", label: "HAS" },
  { color: "#DE3226", label: "AUD" },
  { color: "#1B2D4B", label: "CAD" },
];

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Barrier {
  x: number;
  gapY: number;
  gapH: number;
  color: string;
  label: string;
  width: number;
  scored: boolean;
}

interface SpeedLine {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */
const CAR_X_RATIO = 0.15;
const CAR_W = 60;
const CAR_H = 20;
const GRAVITY = 0.35;
const LIFT = -0.55;
const MAX_VEL = 7;
const BARRIER_WIDTH = 50;
const INITIAL_GAP = 200;
const MIN_GAP = 90;
const INITIAL_SPEED = 3;
const MAX_SPEED = 9;
const BARRIER_SPACING = 280;
const PARTICLE_SPAWN_RATE = 0.6;
const SPEED_LINE_COUNT = 15;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function F1Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  /* game state refs (avoid re-renders during game loop) */
  const stateRef = useRef({
    running: false,
    gameOver: false,
    score: 0,
    carY: 0,
    carVY: 0,
    barriers: [] as Barrier[],
    particles: [] as Particle[],
    speedLines: [] as SpeedLine[],
    pressing: false,
    speed: INITIAL_SPEED,
    gapSize: INITIAL_GAP,
    distance: 0,
    w: 800,
    h: 500,
    gridOffset: 0,
    bestScore: 0,
  });

  const animRef = useRef<number>(0);
  const endGameRef = useRef<() => void>(() => {});
  const [displayScore, setDisplayScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [bestScore, setBestScore] = useState(0);

  /* ---------------------------------------------------------------- */
  /* Leaderboard fetch                                                */
  /* ---------------------------------------------------------------- */
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/game");
      if (res.ok) {
        const data: LeaderboardEntry[] = await res.json();
        setLeaderboard(data);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  /* ---------------------------------------------------------------- */
  /* Canvas sizing                                                    */
  /* ---------------------------------------------------------------- */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.min(Math.floor(rect.width * 0.6), 560);
    canvas.width = w;
    canvas.height = h;
    stateRef.current.w = w;
    stateRef.current.h = h;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  /* ---------------------------------------------------------------- */
  /* Init speed lines                                                 */
  /* ---------------------------------------------------------------- */
  const initSpeedLines = useCallback(() => {
    const s = stateRef.current;
    s.speedLines = [];
    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      s.speedLines.push({
        x: Math.random() * s.w,
        y: Math.random() * s.h,
        len: 20 + Math.random() * 40,
        speed: 2 + Math.random() * 4,
      });
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Draw helpers                                                     */
  /* ---------------------------------------------------------------- */
  function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const cw = CAR_W;
    const ch = CAR_H;

    ctx.save();
    ctx.translate(x, y);

    /* Main body */
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.moveTo(0, ch * 0.3);
    ctx.lineTo(cw * 0.15, 0);
    ctx.lineTo(cw * 0.35, ch * 0.1);
    ctx.lineTo(cw * 0.45, ch * 0.1);
    ctx.lineTo(cw * 0.55, 0);
    ctx.lineTo(cw * 0.85, ch * 0.15);
    ctx.lineTo(cw, ch * 0.2);
    ctx.lineTo(cw, ch * 0.45);
    ctx.lineTo(cw * 0.85, ch * 0.55);
    ctx.lineTo(cw * 0.55, ch * 0.7);
    ctx.lineTo(cw * 0.45, ch * 0.7);
    ctx.lineTo(cw * 0.35, ch * 0.6);
    ctx.lineTo(cw * 0.15, ch * 0.7);
    ctx.lineTo(0, ch * 0.5);
    ctx.closePath();
    ctx.fill();

    /* Cockpit */
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.ellipse(cw * 0.52, ch * 0.35, cw * 0.08, ch * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Front wing */
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(cw * -0.02, ch * 0.15, cw * 0.18, ch * 0.08);
    ctx.fillRect(cw * -0.02, ch * 0.52, cw * 0.18, ch * 0.08);

    /* Rear wing */
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(cw * 0.88, ch * 0.05, cw * 0.14, ch * 0.12);
    ctx.fillRect(cw * 0.88, ch * 0.55, cw * 0.14, ch * 0.12);

    /* Front wheel */
    ctx.fillStyle = "#222";
    ctx.fillRect(cw * 0.1, ch * -0.1, cw * 0.12, ch * 0.2);
    ctx.fillRect(cw * 0.1, ch * 0.7, cw * 0.12, ch * 0.2);

    /* Rear wheel */
    ctx.fillStyle = "#222";
    ctx.fillRect(cw * 0.72, ch * -0.08, cw * 0.1, ch * 0.18);
    ctx.fillRect(cw * 0.72, ch * 0.68, cw * 0.1, ch * 0.18);

    /* Halo */
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cw * 0.48, ch * 0.35, ch * 0.25, -0.8, 0.8);
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  /* Game loop                                                        */
  /* ---------------------------------------------------------------- */
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    if (!s.running) return;

    /* Physics */
    if (s.pressing) {
      s.carVY += LIFT;
    } else {
      s.carVY += GRAVITY;
    }
    s.carVY = Math.max(-MAX_VEL, Math.min(MAX_VEL, s.carVY));
    s.carY += s.carVY;

    /* Ramp difficulty */
    s.distance += s.speed;
    s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.distance * 0.0003);
    s.gapSize = Math.max(MIN_GAP, INITIAL_GAP - s.distance * 0.012);
    s.score = Math.floor(s.distance / 10);

    /* Move barriers */
    for (const b of s.barriers) {
      b.x -= s.speed;
    }

    /* Remove off-screen barriers */
    s.barriers = s.barriers.filter((b) => b.x + b.width > -10);

    /* Spawn barriers */
    const lastBarrier = s.barriers[s.barriers.length - 1];
    const spawnX = lastBarrier ? lastBarrier.x + BARRIER_SPACING : s.w + 100;
    if (!lastBarrier || lastBarrier.x < s.w - BARRIER_SPACING + 50) {
      const margin = 40;
      const gapY =
        margin + Math.random() * (s.h - s.gapSize - margin * 2);
      const team =
        TEAM_PALETTE[Math.floor(Math.random() * TEAM_PALETTE.length)];
      s.barriers.push({
        x: Math.max(spawnX, s.w + 50),
        gapY,
        gapH: s.gapSize,
        color: team.color,
        label: team.label,
        width: BARRIER_WIDTH,
        scored: false,
      });
    }

    /* Particles (exhaust / sparks) */
    const carX = s.w * CAR_X_RATIO;
    if (Math.random() < PARTICLE_SPAWN_RATE) {
      const isSpark = Math.random() < 0.3;
      s.particles.push({
        x: carX + CAR_W * 0.95,
        y: s.carY + CAR_H * 0.3 + Math.random() * CAR_H * 0.4,
        vx: 1 + Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        life: isSpark ? 10 + Math.random() * 15 : 15 + Math.random() * 20,
        maxLife: 0,
        size: isSpark ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
        color: isSpark ? "#FFD700" : "#E8002D",
      });
      s.particles[s.particles.length - 1].maxLife =
        s.particles[s.particles.length - 1].life;
    }

    /* Update particles */
    for (const p of s.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    s.particles = s.particles.filter((p) => p.life > 0);

    /* Speed lines */
    for (const sl of s.speedLines) {
      sl.x -= sl.speed * (s.speed / INITIAL_SPEED);
      if (sl.x + sl.len < 0) {
        sl.x = s.w + Math.random() * 100;
        sl.y = Math.random() * s.h;
      }
    }

    /* Grid scroll */
    s.gridOffset = (s.gridOffset + s.speed * 0.5) % 40;

    /* Collision: ceiling / floor */
    if (s.carY < 0 || s.carY + CAR_H > s.h) {
      endGameRef.current();
      return;
    }

    /* Collision: barriers */
    for (const b of s.barriers) {
      const carRight = carX + CAR_W;
      const carBottom = s.carY + CAR_H;
      if (carRight > b.x && carX < b.x + b.width) {
        if (s.carY < b.gapY || carBottom > b.gapY + b.gapH) {
          endGameRef.current();
          return;
        }
      }
      /* Score for passing a barrier */
      if (!b.scored && b.x + b.width < carX) {
        b.scored = true;
      }
    }

    /* ---- RENDER ---- */
    ctx.clearRect(0, 0, s.w, s.h);

    /* Background */
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, s.w, s.h);

    /* Scrolling grid */
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let gx = -s.gridOffset; gx < s.w; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, s.h);
      ctx.stroke();
    }
    for (let gy = 0; gy < s.h; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(s.w, gy);
      ctx.stroke();
    }

    /* Speed lines */
    const speedAlpha = Math.min(0.35, (s.speed - INITIAL_SPEED) * 0.06);
    if (speedAlpha > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${speedAlpha})`;
      ctx.lineWidth = 1;
      for (const sl of s.speedLines) {
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x + sl.len, sl.y);
        ctx.stroke();
      }
    }

    /* Barriers */
    for (const b of s.barriers) {
      /* Top barrier */
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, 0, b.width, b.gapY);

      /* Bottom barrier */
      ctx.fillRect(b.x, b.gapY + b.gapH, b.width, s.h - b.gapY - b.gapH);

      /* Edge highlights */
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(b.x, b.gapY - 3, b.width, 3);
      ctx.fillRect(b.x, b.gapY + b.gapH, b.width, 3);

      /* Team label */
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      if (b.gapY > 30) {
        ctx.fillText(b.label, b.x + b.width / 2, b.gapY - 10);
      }
      if (s.h - b.gapY - b.gapH > 30) {
        ctx.fillText(b.label, b.x + b.width / 2, b.gapY + b.gapH + 18);
      }
      ctx.restore();
    }

    /* Particles */
    for (const p of s.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Ceiling / floor lines */
    ctx.fillStyle = "#E8002D";
    ctx.fillRect(0, 0, s.w, 2);
    ctx.fillRect(0, s.h - 2, s.w, 2);

    /* Car */
    drawCar(ctx, carX, s.carY);

    /* HUD: score */
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${s.score}m`, 12, 28);

    /* HUD: speed indicator */
    const speedPct = ((s.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED)) * 100;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px monospace";
    ctx.fillText(`SPD ${Math.round(speedPct)}%`, 12, 46);

    /* HUD: best score */
    if (s.bestScore > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`BEST: ${s.bestScore}m`, s.w - 12, 28);
    }

    setDisplayScore(s.score);
    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  /* ---------------------------------------------------------------- */
  /* End game                                                         */
  /* ---------------------------------------------------------------- */
  const endGame = useCallback(() => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    if (s.score > s.bestScore) {
      s.bestScore = s.score;
      setBestScore(s.score);
    }
    setDisplayScore(s.score);
    setGameOver(true);
    cancelAnimationFrame(animRef.current);

    /* Submit score if logged in */
    if (session?.user?.id && s.score > 0) {
      setScoreSaved(false);
      fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: s.score }),
      })
        .then((r) => {
          if (r.ok) setScoreSaved(true);
          return fetchLeaderboard();
        })
        .catch(() => {
          /* silent */
        });
    } else {
      fetchLeaderboard();
    }
  }, [session, fetchLeaderboard]);

  /* Keep ref in sync so gameLoop can call it without a dep cycle */
  useEffect(() => {
    endGameRef.current = endGame;
  }, [endGame]);

  /* ---------------------------------------------------------------- */
  /* Start / restart                                                  */
  /* ---------------------------------------------------------------- */
  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.running = true;
    s.gameOver = false;
    s.score = 0;
    s.carY = s.h / 2 - CAR_H / 2;
    s.carVY = 0;
    s.barriers = [];
    s.particles = [];
    s.speed = INITIAL_SPEED;
    s.gapSize = INITIAL_GAP;
    s.distance = 0;
    s.gridOffset = 0;
    s.pressing = false;
    setGameOver(false);
    setStarted(true);
    setScoreSaved(false);
    initSpeedLines();
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, initSpeedLines]);

  /* ---------------------------------------------------------------- */
  /* Input handlers                                                   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!stateRef.current.running && stateRef.current.gameOver) {
          startGame();
          return;
        }
        if (!stateRef.current.running && !stateRef.current.gameOver) {
          startGame();
          return;
        }
        stateRef.current.pressing = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        stateRef.current.pressing = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startGame]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (!stateRef.current.running) {
        startGame();
        return;
      }
      stateRef.current.pressing = true;
    },
    [startGame],
  );

  const handlePointerUp = useCallback(() => {
    stateRef.current.pressing = false;
  }, []);

  /* Cleanup */
  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Initial draw (pre-start)                                         */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, s.w, s.h);

    /* Grid */
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < s.w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, s.h);
      ctx.stroke();
    }
    for (let gy = 0; gy < s.h; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(s.w, gy);
      ctx.stroke();
    }

    /* Ceiling / floor */
    ctx.fillStyle = "#E8002D";
    ctx.fillRect(0, 0, s.w, 2);
    ctx.fillRect(0, s.h - 2, s.w, 2);

    /* Car in center */
    drawCar(ctx, s.w * CAR_X_RATIO, s.h / 2 - CAR_H / 2);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-zinc-800 select-none touch-none"
      >
        <canvas
          ref={canvasRef}
          className="block w-full"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Start overlay */}
        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-2">
              <span className="text-red-500">F1</span> Helicopter
            </h2>
            <p className="text-zinc-400 text-sm mb-6 text-center px-4">
              Hold <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs mx-1">Space</kbd>{" "}
              or tap to fly up. Dodge the barriers.
            </p>
            <button
              onClick={startGame}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              Start
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-1 text-red-500">
              Race Over
            </h2>
            <p className="text-4xl font-bold mb-1">{displayScore}m</p>
            {bestScore > 0 && bestScore > displayScore && (
              <p className="text-zinc-500 text-sm mb-2">
                Best: {bestScore}m
              </p>
            )}
            {bestScore > 0 && bestScore === displayScore && (
              <p className="text-amber-400 text-sm mb-2 font-semibold">
                New personal best!
              </p>
            )}
            {scoreSaved && (
              <p className="text-green-400 text-xs mb-2">
                Score saved to leaderboard
              </p>
            )}
            {!session && (
              <p className="text-zinc-500 text-xs mb-2">
                Sign in to save your scores
              </p>
            )}
            <button
              onClick={startGame}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors mt-2"
            >
              Restart
            </button>
            <p className="text-zinc-600 text-xs mt-3">
              Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-xs">Space</kbd> to restart
            </p>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="font-semibold text-sm text-zinc-400 mb-3 uppercase tracking-wide">
            Top Scores
          </h3>
          <div className="space-y-1.5">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 text-right font-mono ${
                      i === 0
                        ? "text-amber-400"
                        : i === 1
                          ? "text-zinc-300"
                          : i === 2
                            ? "text-amber-700"
                            : "text-zinc-500"
                    }`}
                  >
                    {i + 1}.
                  </span>
                  <span className="text-zinc-200">{entry.playerName}</span>
                </div>
                <span className="font-mono text-zinc-400">
                  {entry.score.toLocaleString()}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
