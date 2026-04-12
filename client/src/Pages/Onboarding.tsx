import { useState, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { useappcontext } from "../Context/AppContext";
import api from "../configs/api";

type Step = 1 | 2 | 3;

interface FormData {
  age: string;
  weight: string;
  height: string;
  goal: string;
  calorieIntake: number;
  calorieBurn: number;
}

const GOALS = [
  { id: "lose", label: "Lose Weight", icon: "🔥" },
  { id: "maintain", label: "Maintain Weight", icon: "⚖️" },
  { id: "gain", label: "Gain Muscle", icon: "💪" },
];

const Onboarding = () => {
  const [step, setStep] = useState<Step>(1);
  const [animKey, setAnimKey] = useState(0);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    age: "",
    weight: "",
    height: "",
    goal: "maintain",
    calorieIntake: 2000,
    calorieBurn: 400,
  });
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const { user, setOnboardingCompleted, fetchUser } = useappcontext();

  const goTo = (next: Step, dir: "forward" | "back") => {
    setExitDir(dir === "forward" ? "left" : "right");
    setTimeout(() => {
      setStep(next);
      setAnimKey((k) => k + 1);
      setExitDir(null);
    }, 360);
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      const age = Number(form.age);
      if (!form.age || isNaN(age) || age < 1 || age > 120) {
        toast.error("Please enter a valid age (1–120).");
        return false;
      }
    } else if (step === 2) {
      const weight = Number(form.weight);
      if (!form.weight || isNaN(weight) || weight < 1) {
        toast.error("Please enter a valid weight.");
        return false;
      }
      if (form.height) {
        const height = Number(form.height);
        if (isNaN(height) || height < 50 || height > 300) {
          toast.error("Please enter a valid height (50–300 cm).");
          return false;
        }
      }
    }
    return true;
  };

  const submitOnboarding = async () => {
    if (!user?.id) {
      toast.error("User session not found. Please log in again.");
      return;
    }

    const payload = {
      age: Number(form.age),
      weight: Number(form.weight),
      height: form.height ? Number(form.height) : null,
      goal: form.goal,
      dailycaloriesintake: form.calorieIntake,
      dailycaloriesburned: form.calorieBurn,
      onboardedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      await api.put(`/api/users/${user.id}`, payload);

      // Only persist locally after a confirmed API success
      localStorage.setItem("fitnessUser", JSON.stringify(payload));

      toast.success("Welcome to FitTrack! 🎉");
      setOnboardingCompleted(true);
      fetchUser(user.token ?? "");
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;

      if (status === 401 || status === 403) {
        toast.error("Session expired. Please log in again.");
      } else if (status === 404) {
        toast.error("User not found. Please contact support.");
      } else if (status >= 500) {
        toast.error("Server error. Please try again later.");
      } else {
        toast.error(message || "Failed to save your data. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!validateStep()) return;

    if (step < 3) {
      goTo((step + 1) as Step, "forward");
    } else {
      await submitOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1 && !isSubmitting) goTo((step - 1) as Step, "back");
  };

  const pct = (val: number, min: number, max: number) =>
    ((val - min) / (max - min)) * 100;

  const onMouseDown = (e: React.MouseEvent) => {
    if (isSubmitting) return;
    dragStartX.current = e.clientX;
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || dragStartX.current === null) return;
    setDragX(e.clientX - dragStartX.current);
  };
  const onMouseUp = () => {
    if (!isSubmitting && Math.abs(dragX) > 80) {
      if (dragX < 0) handleContinue();
      else handleBack();
    }
    setDragging(false);
    setDragX(0);
    dragStartX.current = null;
  };

  const getCardTransform = () => {
    if (exitDir === "left") return "translateX(-115%) rotate(-8deg)";
    if (exitDir === "right") return "translateX(115%) rotate(8deg)";
    if (dragging && Math.abs(dragX) > 8)
      return `translateX(${dragX}px) rotate(${dragX * 0.025}deg)`;
    return "translateX(0) rotate(0deg)";
  };

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#111d2c",
            color: "#e2e8f0",
            border: "1px solid #1e3a52",
            borderRadius: "12px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
          },
        }}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }

        .fit-root {
          min-height: 100vh;
          width: 100%;
          background: #080f18;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 24px 24px 40px;
          position: relative;
        }

        .fit-blob {
          position: fixed; border-radius: 50%;
          pointer-events: none; filter: blur(110px); z-index: 0;
        }
        .fit-blob-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(0,200,140,0.08) 0%, transparent 70%);
          top: -250px; left: -200px;
          animation: blobFloat1 9s ease-in-out infinite;
        }
        .fit-blob-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(0,100,255,0.06) 0%, transparent 70%);
          bottom: -150px; right: -150px;
          animation: blobFloat2 12s ease-in-out infinite;
        }
        @keyframes blobFloat1 {
          0%,100% { transform: translate(0,0); }
          50% { transform: translate(40px,50px); }
        }
        @keyframes blobFloat2 {
          0%,100% { transform: translate(0,0); }
          50% { transform: translate(-30px,-40px); }
        }

        .fit-scene {
          position: relative; z-index: 2;
          width: 100%; max-width: 460px;
          display: flex; flex-direction: column;
          align-items: center; gap: 24px;
        }

        .fit-brand {
          width: 100%;
          display: flex; align-items: center; gap: 10px;
          animation: fadeDown 0.5s ease both;
        }
        .fit-logo {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #00c88c, #00a872);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
          box-shadow: 0 4px 18px rgba(0,200,140,0.3);
        }
        .fit-brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.3px;
        }

        .fit-stack {
          position: relative;
          width: 100%;
          perspective: 1000px;
        }

        .fit-ghost {
          position: absolute; width: 100%;
          background: #111d2c; border: 1px solid #1a2f44;
          border-radius: 28px; left: 0;
          pointer-events: none;
        }
        .fit-ghost-2 {
          height: 440px; top: 10px;
          transform: scale(0.95); opacity: 0.5; z-index: 1;
        }
        .fit-ghost-3 {
          height: 440px; top: 20px;
          transform: scale(0.90); opacity: 0.28; z-index: 0;
        }

        .fit-card {
          position: relative; z-index: 10;
          width: 100%;
          background: #111d2c;
          border: 1px solid #1e3048;
          border-radius: 28px;
          padding: 32px 32px 28px;
          box-shadow:
            0 0 0 1px rgba(0,200,140,0.04),
            0 32px 80px rgba(0,0,0,0.65),
            0 8px 24px rgba(0,0,0,0.4);
          cursor: grab;
          user-select: none;
          will-change: transform, opacity;
          transition: transform 0.36s cubic-bezier(0.4,0,0.2,1), opacity 0.36s ease;
        }
        .fit-card:active { cursor: grabbing; }
        .fit-card.card-enter {
          animation: cardEnterAnim 0.48s cubic-bezier(0.34,1.4,0.64,1) both;
        }
        @keyframes cardEnterAnim {
          from { opacity: 0; transform: translateX(70px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }

        .fit-card-top {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 20px;
        }
        .fit-step-pill {
          background: rgba(0,200,140,0.09);
          border: 1px solid rgba(0,200,140,0.18);
          border-radius: 99px; padding: 5px 13px;
          font-size: 11px; font-weight: 600;
          color: #00c88c; letter-spacing: 0.6px; text-transform: uppercase;
        }
        .fit-dots { display: flex; gap: 5px; }
        .fit-dot {
          height: 6px; border-radius: 3px;
          background: #1e2f42;
          transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
          width: 6px;
        }
        .fit-dot.on {
          background: #00c88c; width: 20px;
          box-shadow: 0 0 8px rgba(0,200,140,0.5);
        }

        .fit-prog {
          height: 2px; background: #1a2e42;
          border-radius: 99px; overflow: hidden; margin-bottom: 24px;
        }
        .fit-prog-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #00c88c, #00ffb3);
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
        }

        .fit-q-header {
          display: flex; align-items: flex-start; gap: 14px; margin-bottom: 24px;
        }
        .fit-q-icon {
          width: 46px; height: 46px; flex-shrink: 0;
          background: rgba(0,200,140,0.1);
          border: 1px solid rgba(0,200,140,0.18);
          border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
        }
        .fit-q-title {
          font-family: 'Syne', sans-serif;
          font-size: 19px; font-weight: 700; color: #e2e8f0;
          letter-spacing: -0.4px; margin-bottom: 4px; line-height: 1.2;
        }
        .fit-q-sub { font-size: 13px; color: #4a6a85; line-height: 1.4; }

        .fit-field { margin-bottom: 12px; }
        .fit-label {
          display: block; font-size: 11px; font-weight: 600;
          color: #3d5a73; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 7px;
        }
        .fit-label-req { color: #00c88c; margin-left: 2px; }
        .fit-input {
          display: block; width: 100%;
          background: #0d1825; border: 1.5px solid #1a2e42;
          border-radius: 12px; padding: 14px 18px;
          font-size: 15px; font-family: 'DM Sans', sans-serif;
          color: #e2e8f0; font-weight: 500; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .fit-input:focus {
          border-color: rgba(0,200,140,0.5);
          background: #0f1e2e;
          box-shadow: 0 0 0 3px rgba(0,200,140,0.08);
        }
        .fit-input::placeholder { color: #1e3048; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

        .fit-goals { display: flex; flex-direction: column; gap: 8px; }
        .fit-goal-btn {
          width: 100%; background: #0d1825;
          border: 1.5px solid #1a2e42; border-radius: 12px;
          padding: 13px 16px;
          font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; color: #5a7a96;
          cursor: pointer; text-align: left;
          display: flex; align-items: center; gap: 10px;
          transition: all 0.18s ease;
        }
        .fit-goal-btn:hover { border-color: rgba(0,200,140,0.3); color: #c8dae8; }
        .fit-goal-btn.sel {
          border-color: #00c88c;
          background: rgba(0,200,140,0.07);
          color: #e2e8f0;
        }
        .fit-goal-emoji {
          width: 30px; height: 30px;
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0;
          transition: background 0.18s;
        }
        .fit-goal-btn.sel .fit-goal-emoji { background: rgba(0,200,140,0.12); }

        .fit-targets { margin-top: 18px; }
        .fit-targets-title {
          font-size: 11px; font-weight: 700; color: #3d5a73;
          letter-spacing: 0.7px; text-transform: uppercase; margin-bottom: 14px;
        }
        .fit-slider-row { margin-bottom: 16px; }
        .fit-slider-top {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 10px;
        }
        .fit-slider-label {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: #4a6a85; font-weight: 500;
        }
        .fit-info {
          width: 14px; height: 14px; border-radius: 50%;
          border: 1px solid #2d4a62;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 8px; color: #3d5a73; cursor: help; font-style: italic;
        }
        .fit-slider-val { font-size: 13px; font-weight: 700; color: #00c88c; }
        .fit-track {
          position: relative; height: 36px;
          display: flex; align-items: center; cursor: pointer;
        }
        .fit-track-bar {
          position: relative; width: 100%; height: 4px;
          background: #1a2e42; border-radius: 99px; pointer-events: none;
        }
        .fit-fill {
          position: absolute; left: 0; top: 0; bottom: 0;
          border-radius: 99px;
          background: linear-gradient(90deg, #00c88c, #00ffb3);
          pointer-events: none;
        }
        .fit-thumb {
          position: absolute; top: 50%;
          transform: translate(-50%, -50%);
          width: 16px; height: 16px;
          background: #00c88c; border: 2.5px solid #0d1825;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,200,140,0.5);
          pointer-events: none; transition: box-shadow 0.15s;
        }
        .fit-track:hover .fit-thumb {
          box-shadow: 0 0 0 6px rgba(0,200,140,0.14), 0 2px 8px rgba(0,200,140,0.5);
        }
        input.fit-range {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          opacity: 0; cursor: pointer; z-index: 10;
          margin: 0; padding: 0; -webkit-appearance: none;
        }

        .fit-card-footer {
          margin-top: 22px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 10px;
        }
        .fit-back-btn {
          display: flex; align-items: center; gap: 6px;
          background: transparent; border: 1.5px solid #1e2f42;
          border-radius: 12px; padding: 12px 18px;
          font-family: 'DM Sans', sans-serif; font-size: 13px;
          font-weight: 500; color: #4a6a85; cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .fit-back-btn:hover:not(:disabled) { color: #c8dae8; border-color: #2d4a62; }
        .fit-back-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .fit-continue-btn {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(135deg, #00c88c, #00a872);
          border: none; border-radius: 12px; padding: 14px 20px;
          font-family: 'Syne', sans-serif; font-size: 14px;
          font-weight: 700; color: #051510; cursor: pointer;
          box-shadow: 0 6px 20px rgba(0,200,140,0.3);
          transition: all 0.2s; letter-spacing: 0.2px;
          position: relative; overflow: hidden;
        }
        .fit-continue-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(0,200,140,0.42);
        }
        .fit-continue-btn:active:not(:disabled) { transform: translateY(0); }
        .fit-continue-btn:disabled {
          opacity: 0.7; cursor: not-allowed; transform: none;
        }
        .fit-arr { display: inline-block; transition: transform 0.2s; font-size: 16px; }
        .fit-continue-btn:hover:not(:disabled) .fit-arr { transform: translateX(4px); }

        /* Spinner */
        .fit-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(5,21,16,0.3);
          border-top-color: #051510;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .fit-hint {
          font-size: 11px; color: #1e3048;
          letter-spacing: 0.3px; text-align: center;
          animation: fadeDown 0.6s 0.8s ease both;
        }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="fit-root">
        <div className="fit-blob fit-blob-1" />
        <div className="fit-blob fit-blob-2" />

        <div className="fit-scene">
          <div className="fit-brand">
            <div className="fit-logo">🏃</div>
            <span className="fit-brand-name">FitTrack</span>
          </div>

          <div className="fit-stack">
            <div className="fit-ghost fit-ghost-3" />
            <div className="fit-ghost fit-ghost-2" />

            <div
              key={animKey}
              className="fit-card card-enter"
              style={{
                transform: getCardTransform(),
                opacity: exitDir ? 0 : dragging && Math.abs(dragX) > 70 ? 0.75 : 1,
                transition: dragging ? "none" : undefined,
                cursor: isSubmitting ? "default" : undefined,
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <div className="fit-card-top">
                <div className="fit-step-pill">Step {step} of 3</div>
                <div className="fit-dots">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`fit-dot ${step === s ? "on" : ""}`} />
                  ))}
                </div>
              </div>

              <div className="fit-prog">
                <div className="fit-prog-fill" style={{ width: `${(step / 3) * 100}%` }} />
              </div>

              {/* ── Step 1 ── */}
              {step === 1 && (
                <>
                  <div className="fit-q-header">
                    <div className="fit-q-icon">👤</div>
                    <div>
                      <div className="fit-q-title">How old are you?</div>
                      <div className="fit-q-sub">This helps us calculate your needs</div>
                    </div>
                  </div>
                  <div className="fit-field">
                    <label className="fit-label">Age <span className="fit-label-req">*</span></label>
                    <input
                      className="fit-input" type="number"
                      min={1} max={120} placeholder="e.g. 28"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      onMouseDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                </>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <>
                  <div className="fit-q-header">
                    <div className="fit-q-icon">⚖️</div>
                    <div>
                      <div className="fit-q-title">Your measurements</div>
                      <div className="fit-q-sub">Help us track your progress</div>
                    </div>
                  </div>
                  <div className="fit-field">
                    <label className="fit-label">Weight (kg) <span className="fit-label-req">*</span></label>
                    <input
                      className="fit-input" type="number"
                      min={1} placeholder="e.g. 72"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      onMouseDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div className="fit-field">
                    <label className="fit-label">Height (cm) – Optional</label>
                    <input
                      className="fit-input" type="number"
                      min={1} placeholder="e.g. 175"
                      value={form.height}
                      onChange={(e) => setForm({ ...form, height: e.target.value })}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <>
                  <div className="fit-q-header">
                    <div className="fit-q-icon">🎯</div>
                    <div>
                      <div className="fit-q-title">What's your goal?</div>
                      <div className="fit-q-sub">We'll tailor your experience</div>
                    </div>
                  </div>

                  <div className="fit-goals">
                    {GOALS.map((g) => (
                      <button
                        key={g.id}
                        className={`fit-goal-btn ${form.goal === g.id ? "sel" : ""}`}
                        onClick={() => setForm({ ...form, goal: g.id })}
                        onMouseDown={(e) => e.stopPropagation()}
                        disabled={isSubmitting}
                      >
                        <span className="fit-goal-emoji">{g.icon}</span>
                        {g.label}
                      </button>
                    ))}
                  </div>

                  <div className="fit-targets">
                    <div className="fit-targets-title">Daily Targets</div>

                    <div className="fit-slider-row">
                      <div className="fit-slider-top">
                        <span className="fit-slider-label">
                          Calorie Intake
                          <span className="fit-info" title="Target daily caloric intake">i</span>
                        </span>
                        <span className="fit-slider-val">{form.calorieIntake} kcal</span>
                      </div>
                      <div className="fit-track" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="fit-track-bar">
                          <div className="fit-fill" style={{ width: `${pct(form.calorieIntake, 1200, 4000)}%` }} />
                          <div className="fit-thumb" style={{ left: `${pct(form.calorieIntake, 1200, 4000)}%` }} />
                        </div>
                        <input
                          type="range" className="fit-range"
                          min={1200} max={4000} step={50}
                          value={form.calorieIntake}
                          disabled={isSubmitting}
                          onChange={(e) => setForm({ ...form, calorieIntake: +e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="fit-slider-row">
                      <div className="fit-slider-top">
                        <span className="fit-slider-label">
                          Calorie Burn
                          <span className="fit-info" title="Target calories burned through exercise">i</span>
                        </span>
                        <span className="fit-slider-val">{form.calorieBurn} kcal</span>
                      </div>
                      <div className="fit-track" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="fit-track-bar">
                          <div className="fit-fill" style={{ width: `${pct(form.calorieBurn, 100, 2500)}%` }} />
                          <div className="fit-thumb" style={{ left: `${pct(form.calorieBurn, 100, 2500)}%` }} />
                        </div>
                        <input
                          type="range" className="fit-range"
                          min={100} max={2500} step={50}
                          value={form.calorieBurn}
                          disabled={isSubmitting}
                          onChange={(e) => setForm({ ...form, calorieBurn: +e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="fit-card-footer">
                {step > 1 && (
                  <button
                    className="fit-back-btn"
                    onClick={handleBack}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={isSubmitting}
                  >
                    ← Back
                  </button>
                )}
                <button
                  className="fit-continue-btn"
                  onClick={handleContinue}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="fit-spinner" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {step === 3 ? "Get Started" : "Continue"}
                      <span className="fit-arr">→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="fit-hint">drag card left / right to navigate</p>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
