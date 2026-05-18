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
const GRAVITY = 0.3;
const LIFT = -0.5;
const MAX_VEL = 5.5;

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
  updatedAt: string;
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
    lastTime: 0, // for delta-time
  });

  const animRef = useRef<number>(0);
  const endGameRef = useRef<() => void>(() => {});
  const gameTokenRef = useRef<string | null>(null);
  const activePointerRef = useRef<number | null>(null); // track single pointer
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

  // Pre-rendered crowd strip (avoids hundreds of fillRect per frame)
  const crowdCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const buildCrowdStrip = useCallback((width: number, stripH: number) => {
    const offscreen = document.createElement("canvas");
    // Make it wider than the viewport for seamless scrolling
    offscreen.width = width + 100;
    offscreen.height = stripH;
    const octx = offscreen.getContext("2d");
    if (!octx) return null;
    octx.fillStyle = "#2a2a2a";
    octx.fillRect(0, 0, offscreen.width, stripH);
    const colors = ["#e55", "#55e", "#ee5", "#5e5", "#e5e", "#5ee", "#fa0", "#fff"];
    for (let row = 0; row < 3; row++) {
      for (let cx = 0; cx < offscreen.width; cx += 6) {
        const ci = (cx * 7 + row * 13) % colors.length;
        octx.fillStyle = colors[ci];
        octx.globalAlpha = 0.4;
        octx.fillRect(cx, 3 + row * 7, 3, 4);
      }
    }
    octx.globalAlpha = 1;
    return offscreen;
  }, []);

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
    crowdCanvasRef.current = buildCrowdStrip(w, 22);
  }, [buildCrowdStrip]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  // ── Draw top-down F1 car facing RIGHT ──
  // F1 cars from above: narrow pointed nose, wider at sidepods, flat rear with wide wing
  function drawCar(ctx: CanvasRenderingContext2D, cx: number, cy: number, tilt: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);

    const hw = CAR_W / 2; // 25
    const hh = CAR_H / 2; // 12

    // -- Rear wheels (wider, at the back) --
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-hw * 0.6, -hh - 5, 11, 6);
    ctx.fillRect(-hw * 0.6, hh - 1, 11, 6);

    // -- Front wheels (narrower, forward) --
    ctx.fillRect(hw * 0.4, -hh - 4, 8, 5);
    ctx.fillRect(hw * 0.4, hh - 1, 8, 5);

    // -- Rear wing (wide white bar at the very back) --
    ctx.fillStyle = "#eee";
    ctx.fillRect(-hw - 2, -hh * 1.1, 3, hh * 2.2);

    // -- Main body: angular F1 shape --
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    // Nose (sharp point to the right)
    ctx.moveTo(hw + 6, 0);
    // Top edge: nose to front wing area, then widens to sidepods
    ctx.lineTo(hw * 0.6, -hh * 0.25);
    ctx.lineTo(hw * 0.3, -hh * 0.3);
    ctx.lineTo(hw * 0.1, -hh * 0.35);
    // Sidepod bulge
    ctx.lineTo(-hw * 0.15, -hh * 0.7);
    ctx.lineTo(-hw * 0.5, -hh * 0.75);
    // Rear taper to engine
    ctx.lineTo(-hw * 0.8, -hh * 0.5);
    ctx.lineTo(-hw, -hh * 0.35);
    // Bottom (mirror)
    ctx.lineTo(-hw, hh * 0.35);
    ctx.lineTo(-hw * 0.8, hh * 0.5);
    ctx.lineTo(-hw * 0.5, hh * 0.75);
    ctx.lineTo(-hw * 0.15, hh * 0.7);
    ctx.lineTo(hw * 0.1, hh * 0.35);
    ctx.lineTo(hw * 0.3, hh * 0.3);
    ctx.lineTo(hw * 0.6, hh * 0.25);
    ctx.closePath();
    ctx.fill();

    // -- Engine cover (darker strip down the center-rear) --
    ctx.fillStyle = "#b0001f";
    ctx.beginPath();
    ctx.moveTo(-hw, -hh * 0.25);
    ctx.lineTo(-hw * 0.1, -hh * 0.3);
    ctx.lineTo(-hw * 0.1, hh * 0.3);
    ctx.lineTo(-hw, hh * 0.25);
    ctx.closePath();
    ctx.fill();

    // -- Airbox (dark rectangle above engine, behind cockpit) --
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-hw * 0.05, -2, 4, 4);

    // -- Cockpit (dark opening) --
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.ellipse(hw * 0.15, 0, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // -- Halo bar --
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hw * 0.25, -3);
    ctx.lineTo(hw * 0.08, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hw * 0.25, 3);
    ctx.lineTo(hw * 0.08, 3);
    ctx.stroke();

    // -- Driver helmet --
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.arc(hw * 0.18, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(hw * 0.18, -0.5, 2, 1);

    // -- Front wing endplates --
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(hw * 0.7, -hh * 0.8, 2, hh * 0.5);
    ctx.fillRect(hw * 0.7, hh * 0.3, 2, hh * 0.5);
    // Front wing main planes
    ctx.strokeStyle = "#E8002D";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hw * 0.72, -hh * 0.8);
    ctx.lineTo(hw * 0.72, -hh * 0.3);
    ctx.moveTo(hw * 0.72, hh * 0.3);
    ctx.lineTo(hw * 0.72, hh * 0.8);
    ctx.stroke();

    // -- White number --
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", -hw * 0.35, 0);

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

      const grandstandH = 22;
      const kerbH = KERB_SIZE;
      const trackTop = grandstandH + kerbH;
      const trackBot = h - grandstandH - kerbH;

      // ── Sky/background ──
      ctx.fillStyle = "#0f0f0f";
      ctx.fillRect(0, 0, w, h);

      // ── Grandstands (pre-rendered crowd strip, single drawImage each) ──
      const crowdCanvas = crowdCanvasRef.current;
      const crowdScroll = Math.floor(s.scrollOffset * 0.3) % 100;
      if (crowdCanvas) {
        ctx.drawImage(crowdCanvas, crowdScroll, 0, w, grandstandH, 0, 0, w, grandstandH);
        ctx.drawImage(crowdCanvas, crowdScroll, 0, w, grandstandH, 0, h - grandstandH, w, grandstandH);
      } else {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(0, 0, w, grandstandH);
        ctx.fillRect(0, h - grandstandH, w, grandstandH);
      }
      // Barrier walls
      ctx.fillStyle = "#444";
      ctx.fillRect(0, grandstandH - 2, w, 2);
      ctx.fillRect(0, h - grandstandH, w, 2);

      // ── Kerb strips ──
      const kerbScroll = s.scrollOffset % (kerbH * 2);
      for (let kx = -kerbScroll; kx < w + kerbH * 2; kx += kerbH * 2) {
        ctx.fillStyle = "#E8002D";
        ctx.fillRect(kx, grandstandH, kerbH, kerbH);
        ctx.fillStyle = "#fff";
        ctx.fillRect(kx + kerbH, grandstandH, kerbH, kerbH);
        ctx.fillStyle = "#fff";
        ctx.fillRect(kx, h - grandstandH - kerbH, kerbH, kerbH);
        ctx.fillStyle = "#E8002D";
        ctx.fillRect(kx + kerbH, h - grandstandH - kerbH, kerbH, kerbH);
      }

      // ── Asphalt track surface ──
      ctx.fillStyle = "#222";
      ctx.fillRect(0, trackTop, w, trackBot - trackTop);

      // ── Track edge white lines (continuous, like a real circuit) ──
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, trackTop, w, 1);
      ctx.fillRect(0, trackBot - 1, w, 1);

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
      const playTop = trackTop;
      const playBot = trackBot;

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
      ctx.fillText(`${s.score}m`, 12, trackTop + 8);

      const speedPct = Math.round(((s.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED)) * 100);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px monospace";
      ctx.fillText(`SPD ${speedPct}%`, 12, trackTop + 28);

      if (s.bestScore > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`BEST: ${s.bestScore}m`, w - 12, trackTop + 8);
      }
    },
    [],
  );

  // ── Game loop (delta-time corrected: same speed at any refresh rate) ──
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    if (!s.running) return;

    // Delta-time: normalize to 60fps baseline. Clamp to prevent spiral on tab-switch.
    const rawDt = s.lastTime === 0 ? 16.67 : timestamp - s.lastTime;
    s.lastTime = timestamp;
    const dt = Math.min(rawDt, 50) / 16.67; // 1.0 at 60fps, 0.5 at 120fps, 2.0 at 30fps

    const { w, h } = s;
    const grandstandH = 22;
    const kerbH = KERB_SIZE;
    const playTop = grandstandH + kerbH;
    const playBot = h - grandstandH - kerbH;
    const carX = w * CAR_X_RATIO;

    // ── Physics (all multiplied by dt) ──
    if (s.holding) {
      s.vel += LIFT * dt;
    } else {
      s.vel += GRAVITY * dt;
    }
    s.vel = Math.max(-MAX_VEL, Math.min(MAX_VEL, s.vel));
    s.carY += s.vel * dt;

    // ── Difficulty ramp ──
    s.distance += s.speed * dt;
    s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.distance * 0.0003);
    s.gapSize = Math.max(MIN_GAP, INITIAL_GAP - s.distance * 0.008);
    s.score = Math.floor(s.distance / 10);
    s.scrollOffset += s.speed * dt;

    // ── Move barriers left ──
    for (const b of s.barriers) {
      b.x -= s.speed * dt;
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

    // ── Particles (exhaust trail, dt-adjusted spawn rate) ──
    if (Math.random() < 0.6 * dt) {
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
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
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

    // Save score (include anti-cheat token)
    const token = gameTokenRef.current;
    if (session?.user?.id && s.score > 0 && token) {
      setScoreSaved(false);
      fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: s.score, token }),
      })
        .then(async (r) => {
          if (r.ok) {
            setScoreSaved(true);
            // Sync best score from server (the source of truth)
            const data = await r.json();
            if (typeof data.bestScore === "number" && data.bestScore > s.bestScore) {
              s.bestScore = data.bestScore;
              setBestScore(data.bestScore);
            }
          }
          return fetchLeaderboard();
        })
        .catch(() => {});
      gameTokenRef.current = null; // consume the token
    } else {
      fetchLeaderboard();
    }
  }, [session, fetchLeaderboard, renderFrame]);

  useEffect(() => {
    endGameRef.current = endGame;
  }, [endGame]);

  // ── Fetch anti-cheat token (fire-and-forget; game still works without it) ──
  const fetchGameToken = useCallback(async () => {
    try {
      const res = await fetch("/api/game/token");
      if (res.ok) {
        const data = await res.json();
        gameTokenRef.current = data.token;
      }
    } catch {
      /* game still plays, score just won't save */
    }
  }, []);

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
    s.lastTime = 0;

    setGameOver(false);
    setStarted(true);
    setScoreSaved(false);

    // Fetch a signed game token for this session
    gameTokenRef.current = null;
    fetchGameToken();

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, fetchGameToken]);

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
  // Track a single pointer to prevent multi-touch exploits on mobile.
  // Only the first pointer down is honoured; additional fingers are ignored.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      // Ignore if we already have an active pointer (multi-touch block)
      if (activePointerRef.current !== null) return;
      activePointerRef.current = e.pointerId;

      // Capture so we get pointerup even if finger moves off canvas
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

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

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Only release if this is the tracked pointer
    if (e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
    stateRef.current.holding = false;
  }, []);

  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
    stateRef.current.holding = false;
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
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
          onPointerCancel={handlePointerCancel}
          onTouchStart={(e) => e.preventDefault()}
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
