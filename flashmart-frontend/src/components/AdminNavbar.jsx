import React from "react";

function AdminNavbar({ activePage, setActivePage }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🛒</span>
        <span className="brand-name">Flashmart</span>
        <span style={{ marginLeft: 8, fontSize: 11, background: "#f4c430", color: "#1a3020", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>ADMIN</span>
      </div>

      {/* ADMIN links only — no Cart, Orders, Address */}
      <div className="navbar-links">
        <button
          className={`nav-btn ${activePage==="admin"?"active":""}`}
          onClick={() => setActivePage("admin")}
          style={{ color: activePage === "admin" ? "#fff" : "#f4c430" }}
        >
          ⚙️ Admin Panel
        </button>
      </div>

      <div className="navbar-user">
        <button className="nav-btn" onClick={() => { localStorage.clear(); setActivePage("login"); }}>Logout</button>
        <div className="user-avatar" style={{ background: "#f4c430", color: "#1a3020" }}>A</div>
      </div>
    </nav>
  );
}

export default AdminNavbar;