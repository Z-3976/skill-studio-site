"use client";

import {
  IconActivityHeartbeat,
  IconBarbellFilled,
  IconBoltFilled,
  IconDumbbell,
  IconFlameFilled,
  IconJumpRope,
  IconRun,
  IconWeight,
} from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";

type AuthMode = "login" | "register";

type TrailDot = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
};

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const ambientParticles = [
  { left: "8%", top: "18%", size: 4, delay: "0s", duration: "9s" },
  { left: "18%", top: "66%", size: 6, delay: "-2s", duration: "13s" },
  { left: "27%", top: "28%", size: 3, delay: "-1s", duration: "10s" },
  { left: "38%", top: "78%", size: 5, delay: "-4s", duration: "12s" },
  { left: "47%", top: "16%", size: 4, delay: "-3s", duration: "8s" },
  { left: "58%", top: "34%", size: 7, delay: "-5s", duration: "15s" },
  { left: "66%", top: "70%", size: 4, delay: "-2.5s", duration: "11s" },
  { left: "75%", top: "20%", size: 5, delay: "-6s", duration: "14s" },
  { left: "84%", top: "58%", size: 3, delay: "-1.7s", duration: "9s" },
  { left: "90%", top: "36%", size: 6, delay: "-4.8s", duration: "13s" },
  { left: "12%", top: "84%", size: 4, delay: "-2.1s", duration: "10s" },
  { left: "52%", top: "88%", size: 5, delay: "-5.4s", duration: "12s" },
  { left: "68%", top: "10%", size: 4, delay: "-1.2s", duration: "9s" },
  { left: "32%", top: "12%", size: 5, delay: "-4.3s", duration: "14s" },
  { left: "79%", top: "82%", size: 4, delay: "-2.7s", duration: "10s" },
];

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [trailDots, setTrailDots] = useState<TrailDot[]>([]);

  const shellRef = useRef<HTMLElement | null>(null);
  const lastTrailRef = useRef(0);
  const trailIdRef = useRef(0);

  const updatePointer = (clientX: number, clientY: number) => {
    const node = shellRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    node.style.setProperty("--pointer-x", `${x}px`);
    node.style.setProperty("--pointer-y", `${y}px`);
    node.style.setProperty("--pointer-opacity", "1");

    const now = performance.now();
    if (now - lastTrailRef.current < 36) {
      return;
    }

    lastTrailRef.current = now;
    trailIdRef.current += 1;

    const dot: TrailDot = {
      id: trailIdRef.current,
      x,
      y,
      size: 10 + Math.random() * 16,
      delay: Math.random() * 0.35,
    };

    setTrailDots((prev) => [dot, ...prev].slice(0, 18));
  };

  const fadePointer = () => {
    const node = shellRef.current;
    if (!node) {
      return;
    }

    node.style.setProperty("--pointer-opacity", "0");
  };

  const submit = async () => {
    setError("");
    setSuccess("");

    const nextUsername = normalizeUsername(username);
    const nextPassword = password.trim();

    if (nextUsername.length < 3) {
      setError("用户名至少 3 位。");
      return;
    }

    if (nextPassword.length < 6) {
      setError("密码至少 6 位。");
      return;
    }

    if (mode === "register" && nextPassword !== confirmPassword.trim()) {
      setError("两次输入的密码不一致。");
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: nextUsername,
          password: nextPassword,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "操作失败");
      }

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setSuccess("注册成功，现在可以直接登录。");
        return;
      }

      window.location.href = "/";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      ref={shellRef}
      className="auth-shell"
      onMouseMove={(event) => updatePointer(event.clientX, event.clientY)}
      onMouseLeave={fadePointer}
      style={
        {
          "--pointer-x": "50%",
          "--pointer-y": "42%",
          "--pointer-opacity": 0,
        } as CSSProperties
      }
    >
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-pointer-glow" aria-hidden="true" />
      <div className="auth-pointer-core" aria-hidden="true" />

      <div className="auth-scene" aria-hidden="true">
        <div className="scene-grid" />
        <div className="scene-orb orb-a" />
        <div className="scene-orb orb-b" />
        <div className="scene-orb orb-c" />
        <div className="scene-beam beam-a" />
        <div className="scene-beam beam-b" />
        <div className="scene-beam beam-c" />
        <div className="scene-ring ring-a" />
        <div className="scene-ring ring-b" />
        <div className="scene-ring ring-c" />
        <div className="scene-core" />

        <div className="scene-particle-field">
          {ambientParticles.map((particle, index) => (
            <span
              key={`${particle.left}-${particle.top}-${index}`}
              className="ambient-particle"
              style={
                {
                  left: particle.left,
                  top: particle.top,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  animationDelay: particle.delay,
                  animationDuration: particle.duration,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="scene-fitness scene-fit-a">
          <IconBarbellFilled size={36} stroke={1.8} />
        </div>
        <div className="scene-fitness scene-fit-b">
          <IconRun size={34} stroke={1.9} />
        </div>
        <div className="scene-fitness scene-fit-c">
          <IconActivityHeartbeat size={34} stroke={1.9} />
        </div>
        <div className="scene-fitness scene-fit-d">
          <IconFlameFilled size={28} stroke={1.8} />
        </div>
        <div className="scene-fitness scene-fit-e">
          <IconBoltFilled size={26} stroke={1.8} />
        </div>
        <div className="scene-fitness scene-fit-f">
          <IconWeight size={30} stroke={1.8} />
        </div>
        <div className="scene-fitness scene-fit-g">
          <IconJumpRope size={30} stroke={1.85} />
        </div>
        <div className="scene-fitness scene-fit-h">
          <IconDumbbell size={30} stroke={1.85} />
        </div>

        <div className="pointer-trail">
          {trailDots.map((dot, index) => (
            <span
              key={dot.id}
              className="trail-dot"
              style={
                {
                  left: `${dot.x}px`,
                  top: `${dot.y}px`,
                  width: `${dot.size}px`,
                  height: `${dot.size}px`,
                  animationDelay: `${dot.delay}s`,
                  opacity: `${Math.max(0.16, 1 - index * 0.06)}`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <section className="auth-card">
        <div className="auth-copy">
          <h1>亿达商学</h1>
          <p>
            把抖音做图、短视频脚本、直播话术和小红书内容及生图整合为一个智能体，根据门店资料、记忆和结果不断完善。
          </p>

          <div className="auth-highlight-row">
            <span className="auth-highlight">更简单</span>
            <span className="auth-highlight">更便捷</span>
            <span className="auth-highlight">更智能</span>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${mode === "login" ? " active" : ""}`}
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={`auth-tab${mode === "register" ? " active" : ""}`}
              onClick={() => setMode("register")}
            >
              注册
            </button>
          </div>

          <div className="auth-fields">
            <label className="auth-field">
              <span>账号</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="输入你的账号"
                autoComplete="username"
              />
            </label>

            <label className="auth-field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入密码"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {mode === "register" ? (
              <label className="auth-field">
                <span>确认密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="再输入一次密码"
                  autoComplete="new-password"
                />
              </label>
            ) : null}
          </div>

          {error ? <p className="auth-message danger">{error}</p> : null}
          {success ? <p className="auth-message success">{success}</p> : null}

          <button type="button" className="auth-submit" onClick={() => void submit()} disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "进入工作台" : "创建账号"}
          </button>
        </div>
      </section>
    </main>
  );
}
