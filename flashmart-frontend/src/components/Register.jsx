import React, { useState } from "react";
import { authAPI } from "../api/api";

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Outfit', sans-serif;
}

.fm-login-page {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;   /* 🔥 removes scroll gap */
}

/* LEFT SIDE */
.fm-login-left {
  flex: 1;
  padding: 60px 80px;   /* match login */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.fm-login-title {
  font-size: 48px;
  font-weight: 600;
  margin-bottom: 10px;
}

.fm-login-title span {
  color: #ff6b00;
}

.fm-login-subtitle {
  color: #6b7280;
  margin-bottom: 40px;
}

.fm-login-field {
  margin-bottom: 20px;
}

.fm-login-label {
  font-size: 13px;
  letter-spacing: 1px;
  margin-bottom: 5px;
  display: block;
}

.fm-login-input {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #ddd;
  background: #f3f4f6;
  font-size: 14px;
}

.fm-login-btn {
  width: 100%;
  padding: 18px;
  border-radius: 12px;
  border: none;
  background: #ff6b00;
  color: white;
  font-size: 16px;
  cursor: pointer;
  margin-top: 10px;
}

.fm-login-btn:hover {
  background: #e65c00;
}

.fm-login-switch {
  margin-top: 20px;
  text-align: center;
}

.fm-login-switch-link {
  color: #ff6b00;
  cursor: pointer;
  font-weight: 500;
}

/* RIGHT SIDE */
.fm-login-right {
  flex: 1;
  background: linear-gradient(135deg, #0f3d2e, #1b5e20);
  color: white;
  padding: 60px 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.fm-login-badge {
  margin-bottom: 20px;
}

.fm-login-offer-card {
  background: rgba(255,255,255,0.08);
  padding: 30px;
  border-radius: 20px;
  margin-bottom: 40px;
}

.fm-login-offer-title {
  font-size: 22px;
  font-weight: 600;
}

.fm-login-step {
  display: flex;
  margin-bottom: 20px;
}

.fm-login-step-num {
  margin-right: 12px;
  font-weight: bold;
}

.fm-login-step-title {
  display: block;
  font-weight: 500;
}

.fm-login-step-sub {
  font-size: 13px;
  opacity: 0.8;
}
`;

function Register({ setActivePage, showToast }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("user");
  const [loading, setLoading]   = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      showToast("Please fill all fields ⚠️", "error");
      return;
    }

    setLoading(true);
    try {
      await authAPI.register(email, password, role);
      showToast("Account created successfully 🎉");
      setActivePage("login");
    } catch {
      showToast("Registration failed ❌", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>

      <div className="fm-login-page">

        {/* LEFT */}
        <div className="fm-login-left">
          <div className="fm-login-brand">
            <div className="fm-login-brand-icon">🛒</div>
            <span className="fm-login-brand-name">Flashmart</span>
          </div>

          <h1 className="fm-login-title">
            Create <span>account.</span>
          </h1>

          <p className="fm-login-subtitle">
            Join Flashmart and enjoy fast delivery of fresh groceries.
          </p>

          <div className="fm-login-field">
            <label className="fm-login-label">Email Address</label>
            <input
              className="fm-login-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
            />
          </div>

          <div className="fm-login-field">
            <label className="fm-login-label">Role</label>
            <select
              className="fm-login-input"
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            className="fm-login-btn"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Account →"}
          </button>

          <p className="fm-login-switch">
            Already have an account?{" "}
            <span
              className="fm-login-switch-link"
              onClick={() => setActivePage("login")}
            >
              Sign in
            </span>
          </p>
        </div>

        {/* RIGHT */}
        <div className="fm-login-right">
          <div className="fm-login-badge">⚡ 15-min delivery</div>

          <div className="fm-login-offer-card">
            <div className="fm-login-offer-title">Join Flashmart Today</div>
            <p className="fm-login-offer-desc">
              Create your account and start shopping fresh groceries instantly.
            </p>
          </div>

          <div className="fm-login-steps">
            {[
              { n: "01", title: "Sign up", sub: "Quick & easy registration." },
              { n: "02", title: "Explore products", sub: "Fresh items daily." },
              { n: "03", title: "Fast delivery", sub: "15 mins doorstep delivery." },
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

export default Register;