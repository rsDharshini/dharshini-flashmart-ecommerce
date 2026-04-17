import React, { useState } from "react";
import { authAPI } from "../api/api";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,600;1,500&display=swap');

  .fm-login-page {
    min-height: 100vh;
    width: 100vw;
    display: flex;
    background: #f0f4f0;
    font-family: 'Outfit', sans-serif;
    position: fixed;
    top: 0; left: 0;
    z-index: 9999;
    overflow: auto;
  }

  /* ── Left: Form Panel ───────────────────────────────── */
  .fm-login-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60px 72px;
    background: #fff;
  }

  .fm-login-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 44px;
  }

  .fm-login-brand-icon {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #f97316, #ea580c);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 4px 12px rgba(249,115,22,0.3);
  }

  .fm-login-brand-name {
    font-weight: 800;
    font-size: 22px;
    color: #1a3020;
    letter-spacing: -0.3px;
  }

  .fm-login-title {
    font-size: 36px;
    font-weight: 800;
    color: #1a3020;
    letter-spacing: -0.8px;
    line-height: 1.15;
    margin-bottom: 10px;
  }

  .fm-login-title span {
    font-family: 'Lora', serif;
    font-style: italic;
    font-weight: 500;
    color: #f97316;
  }

  .fm-login-subtitle {
    color: #6b8f71;
    font-size: 15px;
    font-weight: 400;
    margin-bottom: 36px;
    line-height: 1.6;
  }

  .fm-login-field {
    margin-bottom: 18px;
  }

  .fm-login-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #4a7050;
    margin-bottom: 8px;
  }

  .fm-login-input {
    width: 100%;
    padding: 14px 18px;
    border: 1.5px solid #dde8de;
    border-radius: 12px;
    font-family: 'Outfit', sans-serif;
    font-size: 15px;
    color: #1a3020;
    background: #f9fbf9;
    outline: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .fm-login-input::placeholder { color: #a8c4aa; }

  .fm-login-input:focus {
    border-color: #f97316;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(249,115,22,0.10);
  }

  .fm-login-btn {
    width: 100%;
    margin-top: 10px;
    padding: 15px 24px;
    background: linear-gradient(135deg, #f97316, #ea580c);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.22s ease;
    box-shadow: 0 4px 16px rgba(249,115,22,0.3);
  }

  .fm-login-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(249,115,22,0.4);
  }

  .fm-login-btn:active { transform: translateY(0); }

  .fm-login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .fm-login-switch {
    margin-top: 22px;
    font-size: 14px;
    color: #6b8f71;
    text-align: center;
  }

  .fm-login-switch-link {
    color: #f97316;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s;
  }

  .fm-login-switch-link:hover {
    color: #ea580c;
    text-decoration: underline;
  }

  /* ── Right: Info Panel ──────────────────────────────── */
  .fm-login-right {
    width: 420px;
    min-width: 420px;
    background: linear-gradient(160deg, #1a3020 0%, #243d28 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60px 44px;
    position: relative;
    overflow: hidden;
  }

  .fm-login-right::before {
    content: '';
    position: absolute;
    top: -100px; right: -80px;
    width: 300px; height: 300px;
    background: rgba(249,115,22,0.07);
    border-radius: 50%;
    pointer-events: none;
  }

  .fm-login-right::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -60px;
    width: 220px; height: 220px;
    background: rgba(249,115,22,0.04);
    border-radius: 50%;
    pointer-events: none;
  }

  .fm-login-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(249,115,22,0.15);
    border: 1px solid rgba(249,115,22,0.35);
    color: #f97316;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 100px;
    margin-bottom: 28px;
    width: fit-content;
  }

  .fm-login-offer-card {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 18px;
    padding: 32px 28px;
    text-align: center;
    margin-bottom: 32px;
    position: relative;
    z-index: 1;
  }

  .fm-login-offer-emoji {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }

  .fm-login-offer-title {
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    margin-bottom: 10px;
    letter-spacing: -0.3px;
  }

  .fm-login-offer-desc {
    font-size: 13px;
    color: #7aaa82;
    line-height: 1.7;
  }

  .fm-login-steps {
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: relative;
    z-index: 1;
  }

  .fm-login-step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .fm-login-step-num {
    width: 30px;
    height: 30px;
    min-width: 30px;
    background: rgba(249,115,22,0.18);
    border: 1px solid rgba(249,115,22,0.35);
    color: #f97316;
    font-size: 11px;
    font-weight: 800;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fm-login-step-title {
    display: block;
    color: #e8f5e9;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .fm-login-step-sub {
    display: block;
    color: #6b9870;
    font-size: 12px;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .fm-login-right { display: none; }
    .fm-login-left { padding: 40px 28px; }
    .fm-login-title { font-size: 28px; }
  }
`;

function Login({ setActivePage, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showToast("Please enter email and password ⚠️", "error");
      return;
    }
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      showToast("Login successful 🚀");
      setActivePage("products");
    } catch {
      showToast("Invalid email or password ❌", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="fm-login-page">

        {/* ── Left: Form ──────────────────────────────── */}
        <div className="fm-login-left">
          <div className="fm-login-brand">
            <div className="fm-login-brand-icon">🛒</div>
            <span className="fm-login-brand-name">Flashmart</span>
          </div>

          <h1 className="fm-login-title">
            Welcome <span>back.</span>
          </h1>
          <p className="fm-login-subtitle">
            Sign in to order fresh groceries<br />delivered in 15 minutes.
          </p>

          <div className="fm-login-field">
            <label className="fm-login-label">Email Address</label>
            <input
              className="fm-login-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div className="fm-login-field">
            <label className="fm-login-label">Password</label>
            <input
              className="fm-login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          <button
            className="fm-login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <p className="fm-login-switch">
            Don't have an account?{" "}
            <span
              className="fm-login-switch-link"
              onClick={() => setActivePage("register")}
            >
              Create one
            </span>
          </p>
        </div>

        {/* ── Right: Info Panel ───────────────────────── */}
        <div className="fm-login-right">
          <div className="fm-login-badge">⚡ 15-min delivery</div>

          <div className="fm-login-offer-card">
            <span className="fm-login-offer-emoji">🛍️</span>
            <div className="fm-login-offer-title">Save ₹100 on<br />Orders ₹500+</div>
            <p className="fm-login-offer-desc">
              Fresh groceries at your door.<br />Quality you can trust, always.
            </p>
          </div>

          <div className="fm-login-steps">
            {[
              { n: "01", title: "Create your account",  sub: "Takes less than a minute." },
              { n: "02", title: "Browse & add to cart", sub: "500+ fresh products daily." },
              { n: "03", title: "Order & relax",        sub: "Delivered in 15 mins, guaranteed." },
            ].map(({ n, title, sub }) => (
              <div className="fm-login-step" key={n}>
                <div className="fm-login-step-num">{n}</div>
                <div>
                  <span className="fm-login-step-title">{title}</span>
                  <span className="fm-login-step-sub">{sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

export default Login;