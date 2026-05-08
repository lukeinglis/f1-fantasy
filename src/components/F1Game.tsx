"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

// ── Team colors for barriers ──
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

const RACE_NAMES = [
  "Australia", "China", "Japan", "Miami", "Canada", "Monaco",
  "Barcelona", "Austria", "Britain", "Belgium", "Hungary",
  "Netherlands", "Italy", "Spain", "Azerbaijan", "Singapore",
  "Austin", "Mexico", "Brazil", "Las Vegas", "Qatar", "Abu Dhabi",
];

// ── Physics ──
const GRAVITY = 0.4;
const LIFT = -0.6;
const MAX_VEL = 7;

// ── Car ──
const CAR_W = 50;
const CAR_H = 24;
const CAR_X_RATIO = 0.2; // 20% from left

// ── Barriers ──
const BARRIER_W = 40;
const INITIAL_GAP = 160;
const MIN_GAP = 80;
const BARRIER_SPACING = 300;

// ── Speed ──
const INITIAL_SPEED = 3;
const MAX_SPEED = 8;

// ── Effects ──
const KERB_SIZE = 8;
const SHAKE_MS = 200;
const SHAKE_PX = 4;

// ── Types ──
interface Barrier {
  x: number;
  gapY: number;
  gapH: number;
  color: string;
  raceName: string;
  scored: boolean;
}
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
interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  createdAt: string;
}

export default function F1Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const stateRef = useRef({
    running: false,
    gameOver: false,
    score: 0,
    carY: 0,
    vel: 0, // vertical velocity
    holding: false, // space/click held
    barriers: [] as Barrier[],
    particles: [] as Particle[],
    speed: INITIAL_SPEED,
    gapSize: INITIAL_GAP,
    distance: 0,
    w: 800,
    h: 450,
    scrollOffset: 0,
    bestScore: 0,
    raceIndex: 0,
    shakeUntil: 0,
  });

  const animRef = useRef<number>(0);
  const endGameRef = useRef<() => void>(() => {});
  const [displayScore, setDisplayScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [bestScore, setBestScore] = useState(0);

  // ── Leaderboard API ──
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/game");
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // ── Resize ──
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.min(Math.floor(w * 0.5625), 450);
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

  // ── Draw top-down F1 car facing RIGHT ──
  function drawCar(ctx: CanvasRenderingContext2D, cx: number, cy: number, tilt: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);

    const hw = CAR_W / 2;
    const hh = CAR_H / 2;

    // Rear wing endplates (widest part, at the back/left)
    ctx.fillStyle = "#fff";
    ctx.fillRect(-hw - 2, -hh - 1, 3, hh * 2 + 2);

    // Rear wheels (big, wide, at the back)
    ctx.fillStyle = "#111";
    ctx.fillRect(-hw * 0.55, -hh - 4, 10, 5);
    ctx.fillRect(-hw * 0.55, hh - 1, 10, 5);
    // Tire sidewall detail
    ctx.fillStyle = "#222";
    ctx.fillRect(-hw * 0.55 + 1, -hh - 3, 8, 3);
    ctx.fillRect(-hw * 0.55 + 1, hh, 8, 3);

    // Front wheels (smaller, further forward)
    ctx.fillStyle = "#111";
    ctx.fillRect(hw * 0.35, -hh - 3, 7, 4);
    ctx.fillRect(hw * 0.35, hh - 1, 7, 4);
    ctx.fillStyle = "#222";
    ctx.fillRect(hw * 0.35 + 1, -hh - 2, 5, 2);
    ctx.fillRect(hw * 0.35 + 1, hh, 5, 2);

    // Engine cover / rear body (darker red, wider)
    ctx.fillStyle = "#a00020";
    ctx.beginPath();
    ctx.moveTo(-hw, -hh * 0.55);
    ctx.lineTo(-hw * 0.3, -hh * 0.75);
    ctx.lineTo(-hw * 0.3, hh * 0.75);
    ctx.lineTo(-hw, hh * 0.55);
    ctx.closePath();
    ctx.fill();

    // Main body (red, tapered toward nose)
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.moveTo(hw + 4, 0); // nose tip
    ctx.lineTo(hw * 0.75, -hh * 0.35);
    ctx.lineTo(hw * 0.4, -hh * 0.5);
    ctx.lineTo(-hw * 0.1, -hh * 0.65);
    ctx.lineTo(-hw * 0.3, -hh * 0.75);
    ctx.lineTo(-hw * 0.3, hh * 0.75);
    ctx.lineTo(-hw * 0.1, hh * 0.65);
    ctx.lineTo(hw * 0.4, hh * 0.5);
    ctx.lineTo(hw * 0.75, hh * 0.35);
    ctx.closePath();
    ctx.fill();

    // Sidepod intakes (dark slots on the sides)
    ctx.fillStyle = "#8a0018";
    ctx.fillRect(hw * 0.05, -hh * 0.6, 8, 3);
    ctx.fillRect(hw * 0.05, hh * 0.6 - 3, 8, 3);

    // Cockpit opening (dark oval, slightly forward)
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.ellipse(hw * 0.2, 0, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Halo (grey arc around cockpit)
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hw * 0.2, 0, 5.5, -1.2, 1.2);
    ctx.stroke();

    // Driver helmet (small colored dot)
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.arc(hw * 0.22, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Front wing elements (lines at the nose)
    ctx.strokeStyle = "#cc0022";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hw * 0.85, -hh * 0.85);
    ctx.lineTo(hw * 0.85, hh * 0.85);
    ctx.stroke();
    ctx.strokeStyle = "#E8002D";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hw * 0.95, -hh * 0.6);
    ctx.lineTo(hw * 0.95, hh * 0.6);
    ctx.stroke();

    // Number on sidepod
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", -hw * 0.1, 0);

    ctx.restore();
  }

  // ── Compute racing line through upcoming barrier gaps ──
  function computeRacingLine(s: typeof stateRef.current) {
    const carX = s.w * CAR_X_RATIO;
    const points: { x: number; y: number }[] = [];
    points.push({ x: carX, y: s.carY });

    const upcoming = s.barriers
      .filter(b => b.x > carX - 20)
      .sort((a, b) => a.x - b.x);

    for (const b of upcoming) {
      const gapCenter = b.gapY + b.gapH / 2;
      points.push({ x: b.x, y: gapCenter });
      points.push({ x: b.x + BARRIER_W, y: gapCenter });
    }
    if (points.length > 1) {
      const last = points[points.length - 1];
      points.push({ x: s.w + 50, y: last.y });
    }
    return points;
  }

  function drawRacingLine(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
    if (points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = "rgba(0, 220, 80, 0.18)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Render one frame ──
  const renderFrame = useCallback(
    (ctx: CanvasRenderingContext2D, s: typeof stateRef.current) => {
      const { w, h } = s;

      // Dark asphalt background (full canvas)
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, w, h);

      // ── Kerb strips at top and bottom edges ──
      const kerbScroll = s.scrollOffset % (KERB_SIZE * 2);
      for (let kx = -kerbScroll; kx < w + KERB_SIZE * 2; kx += KERB_SIZE * 2) {
        // Top kerb
        ctx.fillStyle = "#E8002D";
        ctx.fillRect(kx, 0, KERB_SIZE, KERB_SIZE);
        ctx.fillStyle = "#fff";
        ctx.fillRect(kx + KERB_SIZE, 0, KERB_SIZE, KERB_SIZE);
        // Bottom kerb
        ctx.fillStyle = "#fff";
        ctx.fillRect(kx, h - KERB_SIZE, KERB_SIZE, KERB_SIZE);
        ctx.fillStyle = "#E8002D";
        ctx.fillRect(kx + KERB_SIZE, h - KERB_SIZE, KERB_SIZE, KERB_SIZE);
      }

      // ── Dashed center line scrolling left ──
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([20, 30]);
      ctx.lineDashOffset = -s.scrollOffset;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Speed lines at high speed ──
      const speedRatio = (s.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED);
      if (speedRatio > 0.2) {
        const alpha = Math.min(0.2, speedRatio * 0.25);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Deterministic speed lines based on scroll offset
        for (let i = 0; i < 12; i++) {
          const seed = (i * 7919 + Math.floor(s.scrollOffset * 0.1)) % 1000;
          const ly = KERB_SIZE + ((seed * 31) % (h - KERB_SIZE * 2));
          const lx = (seed * 17) % w;
          const ll = 20 + (seed % 40);
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + ll, ly);
        }
        ctx.stroke();
      }

      // ── Racing line ──
      const racingLinePoints = computeRacingLine(s);
      drawRacingLine(ctx, racingLinePoints);

      // ── Particles ──
      for (const p of s.particles) {
        const lifeRatio = p.life / p.maxLife;
        ctx.globalAlpha = lifeRatio * lifeRatio;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Barriers ──
      const playTop = KERB_SIZE;
      const playBot = h - KERB_SIZE;

      for (const b of s.barriers) {
        // Fade in as barrier enters from right
        const fadeIn = Math.min(1, Math.max(0, (w - b.x) / 80));
        ctx.globalAlpha = fadeIn;

        // Top wall
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, playTop, BARRIER_W, b.gapY - playTop);
        // Bottom wall
        ctx.fillRect(b.x, b.gapY + b.gapH, BARRIER_W, playBot - b.gapY - b.gapH);

        // Checkered pattern on gap edges
        const checkSize = 4;
        for (let cx = 0; cx < BARRIER_W; cx += checkSize * 2) {
          // Top gap edge
          ctx.fillStyle = "#fff";
          ctx.fillRect(b.x + cx, b.gapY - checkSize, checkSize, checkSize);
          ctx.fillStyle = "#000";
          ctx.fillRect(b.x + cx + checkSize, b.gapY - checkSize, checkSize, checkSize);
          // Bottom gap edge
          ctx.fillStyle = "#000";
          ctx.fillRect(b.x + cx, b.gapY + b.gapH, checkSize, checkSize);
          ctx.fillStyle = "#fff";
          ctx.fillRect(b.x + cx + checkSize, b.gapY + b.gapH, checkSize, checkSize);
        }

        // Race name written vertically on the wall
        const topWallH = b.gapY - playTop;
        if (topWallH > 30) {
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.save();
          ctx.translate(b.x + BARRIER_W / 2, playTop + topWallH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(b.raceName.toUpperCase(), 0, 0);
          ctx.restore();
        }
        const botWallH = playBot - b.gapY - b.gapH;
        if (botWallH > 30) {
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.save();
          ctx.translate(b.x + BARRIER_W / 2, b.gapY + b.gapH + botWallH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(b.raceName.toUpperCase(), 0, 0);
          ctx.restore();
        }

        ctx.globalAlpha = 1;
      }

      // ── Car ──
      const carX = w * CAR_X_RATIO;
      const tilt = s.vel * 0.03; // subtle tilt based on velocity
      drawCar(ctx, carX, s.carY, tilt);

      // ── HUD ──
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${s.score}m`, 12, KERB_SIZE + 8);

      const speedPct = Math.round(speedRatio * 100);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px monospace";
      ctx.fillText(`SPD ${speedPct}%`, 12, KERB_SIZE + 30);

      if (s.bestScore > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`BEST: ${s.bestScore}m`, w - 12, KERB_SIZE + 8);
      }
    },
    [],
  );

  // ── Game loop ──
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    if (!s.running) return;

    const { w, h } = s;
    const playTop = KERB_SIZE;
    const playBot = h - KERB_SIZE;
    const carX = w * CAR_X_RATIO;

    // ── Physics ──
    if (s.holding) {
      s.vel += LIFT;
    } else {
      s.vel += GRAVITY;
    }
    s.vel = Math.max(-MAX_VEL, Math.min(MAX_VEL, s.vel));
    s.carY += s.vel;

    // ── Difficulty ramp ──
    s.distance += s.speed;
    s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.distance * 0.0003);
    s.gapSize = Math.max(MIN_GAP, INITIAL_GAP - s.distance * 0.008);
    s.score = Math.floor(s.distance / 10);
    s.scrollOffset += s.speed;

    // ── Move barriers left ──
    for (const b of s.barriers) {
      b.x -= s.speed;
    }
    s.barriers = s.barriers.filter((b) => b.x + BARRIER_W > -10);

    // ── Spawn barriers from right ──
    const rightmost = s.barriers.length > 0
      ? Math.max(...s.barriers.map((b) => b.x))
      : 0;

    if (s.barriers.length === 0 || rightmost < w - BARRIER_SPACING + BARRIER_W) {
      const team = TEAM_PALETTE[Math.floor(Math.random() * TEAM_PALETTE.length)];
      const raceName = RACE_NAMES[s.raceIndex % RACE_NAMES.length];
      s.raceIndex++;

      const margin = 20;
      const maxGapY = playBot - s.gapSize - margin;
      const gapY = playTop + margin + Math.random() * Math.max(0, maxGapY - playTop - margin);

      s.barriers.push({
        x: w + 20,
        gapY,
        gapH: s.gapSize,
        color: team.color,
        raceName,
        scored: false,
      });
    }

    // ── Particles (exhaust trail to the LEFT from rear of car) ──
    if (Math.random() < 0.6) {
      const isSpark = Math.random() < 0.3;
      const life = isSpark ? 12 : 18;
      s.particles.push({
        x: carX - CAR_W / 2 - 2,
        y: s.carY + (Math.random() - 0.5) * 6,
        vx: -1.5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        life,
        maxLife: life,
        size: isSpark ? 2 : 3,
        color: isSpark ? "#FFD700" : Math.random() < 0.5 ? "#ff6600" : "#E8002D",
      });
    }
    for (const p of s.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
    }
    s.particles = s.particles.filter((p) => p.life > 0);

    // ── Collision: top/bottom walls ──
    if (s.carY - CAR_H / 2 < playTop || s.carY + CAR_H / 2 > playBot) {
      s.shakeUntil = performance.now() + SHAKE_MS;
      endGameRef.current();
      return;
    }

    // ── Collision: barriers ──
    const carLeft = carX - CAR_W / 2;
    const carRight = carX + CAR_W / 2;
    const carTop = s.carY - CAR_H / 2;
    const carBot = s.carY + CAR_H / 2;

    for (const b of s.barriers) {
      if (carRight > b.x && carLeft < b.x + BARRIER_W) {
        // Car overlaps barrier X range, check if outside gap
        if (carTop < b.gapY || carBot > b.gapY + b.gapH) {
          s.shakeUntil = performance.now() + SHAKE_MS;
          endGameRef.current();
          return;
        }
      }
      if (!b.scored && b.x + BARRIER_W < carLeft) {
        b.scored = true;
      }
    }

    // ── Render ──
    const now = performance.now();
    ctx.save();
    if (now < s.shakeUntil) {
      const decay = (s.shakeUntil - now) / SHAKE_MS;
      ctx.translate(
        (Math.random() - 0.5) * SHAKE_PX * 2 * decay,
        (Math.random() - 0.5) * SHAKE_PX * 2 * decay,
      );
    }
    renderFrame(ctx, s);
    ctx.restore();

    setDisplayScore(s.score);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [renderFrame]);

  // ── End game ──
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

    // Shake animation after crash
    const shakeEnd = s.shakeUntil;
    const shakeLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const now = performance.now();
      if (now >= shakeEnd) {
        renderFrame(ctx, s);
        return;
      }
      const decay = (shakeEnd - now) / SHAKE_MS;
      ctx.save();
      ctx.translate(
        (Math.random() - 0.5) * SHAKE_PX * 2 * decay,
        (Math.random() - 0.5) * SHAKE_PX * 2 * decay,
      );
      renderFrame(ctx, s);
      ctx.restore();
      requestAnimationFrame(shakeLoop);
    };

    if (shakeEnd > performance.now()) {
      requestAnimationFrame(shakeLoop);
    }

    cancelAnimationFrame(animRef.current);

    // Save score
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
        .catch(() => {});
    } else {
      fetchLeaderboard();
    }
  }, [session, fetchLeaderboard, renderFrame]);

  useEffect(() => {
    endGameRef.current = endGame;
  }, [endGame]);

  // ── Start game ──
  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.running = true;
    s.gameOver = false;
    s.score = 0;
    s.carY = s.h / 2;
    s.vel = 0;
    s.holding = false;
    s.barriers = [];
    s.particles = [];
    s.speed = INITIAL_SPEED;
    s.gapSize = INITIAL_GAP;
    s.distance = 0;
    s.scrollOffset = 0;
    s.raceIndex = Math.floor(Math.random() * RACE_NAMES.length);
    s.shakeUntil = 0;

    setGameOver(false);
    setStarted(true);
    setScoreSaved(false);
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // ── Keyboard input ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!stateRef.current.running && !stateRef.current.gameOver) {
          startGame();
          return;
        }
        if (stateRef.current.gameOver) {
          startGame();
          return;
        }
        stateRef.current.holding = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        stateRef.current.holding = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startGame]);

  // ── Pointer (mouse/touch) input ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (!stateRef.current.running) {
        startGame();
        // Also set holding so the car moves up immediately
        stateRef.current.holding = true;
        return;
      }
      stateRef.current.holding = true;
    },
    [startGame],
  );

  const handlePointerUp = useCallback(() => {
    stateRef.current.holding = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    stateRef.current.holding = false;
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── Initial draw ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    s.carY = s.h / 2;
    renderFrame(ctx, s);
  }, [renderFrame]);

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
          onPointerLeave={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
        />

        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-2">
              <span className="text-red-500">F1</span> Dodge
            </h2>
            <p className="text-zinc-400 text-sm mb-1 text-center px-4">
              Hold{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs">
                Space
              </kbd>{" "}
              or tap to fly up
            </p>
            <p className="text-zinc-500 text-xs mb-6 text-center px-4">
              Release to fall. Dodge the barriers.
            </p>
            <button
              onClick={startGame}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              Start Race
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-1 text-red-500">Race Over</h2>
            <p className="text-4xl font-bold mb-1">{displayScore}m</p>
            {bestScore > 0 && bestScore > displayScore && (
              <p className="text-zinc-500 text-sm mb-2">Best: {bestScore}m</p>
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
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-xs">
                Space
              </kbd>{" "}
              to restart
            </p>
          </div>
        )}
      </div>

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
