import React, { useEffect, useState } from "react";
import { addressAPI, orderAPI } from "../api/api";
import { getUserFromToken } from "../utils/auth";

function Profile({ userId, showToast, setActivePage }) {
  const [addresses, setAddresses]   = useState([]);
  const [orderStats, setOrderStats] = useState({ total: 0, delivered: 0, processing: 0, cancelled: 0, placed: 0 });
  const [activeTab, setActiveTab]   = useState("profile");
  const [form, setForm] = useState({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" });

  const user  = getUserFromToken();
  const email = user?.email || "user@example.com";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "Apr 2026";

  useEffect(() => {
    addressAPI.getAll(userId).then(d => setAddresses(d.addresses || [])).catch(() => {});
    orderAPI.getOrders(userId).then(d => {
      const orders = d.orders || [];
      setOrderStats({
        total:      orders.length,
        delivered:  orders.filter(o => o.status === "delivered").length,
        processing: orders.filter(o => o.status === "processing").length,
        cancelled:  orders.filter(o => o.status === "cancelled").length,
        placed:     orders.filter(o => o.status === "placed").length,
      });
    }).catch(() => {});
  }, [userId]);

  const handleAddAddress = async () => {
    try {
      await addressAPI.add(userId, form);
      showToast("Address added ✅");
      setForm({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" });
      const d = await addressAPI.getAll(userId);
      setAddresses(d.addresses || []);
    } catch {
      showToast("Failed to add address ❌", "error");
    }
  };

  const initials = email.charAt(0).toUpperCase();

  const sidebarItems = [
    { key: "profile",   icon: "👤", label: "My Profile" },
    { key: "orders",    icon: "📦", label: "My Orders" },
    { key: "addresses", icon: "📍", label: "Addresses" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.avatar}>{initials}</div>
          <div style={styles.sidebarName}>{email.split("@")[0]}</div>
          <div style={styles.sidebarEmail}>{email}</div>
        </div>

        {sidebarItems.map(item => (
          <button key={item.key}
            style={{ ...styles.sidebarBtn, ...(activeTab === item.key ? styles.sidebarBtnActive : {}) }}
            onClick={() => setActiveTab(item.key)}>
            <span style={{ marginRight: 10 }}>{item.icon}</span>{item.label}
          </button>
        ))}

        <button style={styles.logoutBtn} onClick={() => { localStorage.clear(); setActivePage("login"); }}>
          🚪 Logout
        </button>

        <div style={styles.inviteCard}>
          <div style={{ fontSize: 36 }}>🛍️</div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>Invite friends & get ₹100 off!</div>
          <div style={{ fontSize: 12, color: "#666", margin: "4px 0 10px" }}>Share the love and enjoy exclusive rewards</div>
          <button style={styles.inviteBtn}>📨 Invite Now</button>
        </div>
      </div>

      <div style={styles.content}>

        {activeTab === "profile" && (
          <>
            <div style={styles.profileHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={styles.bigAvatar}>{initials}</div>
                <div>
                  <div style={styles.profileName}>{email.split("@")[0]}</div>
                  <div style={styles.profileMeta}>{email}</div>
                  <div style={styles.profileMeta}>
                    📅 Member since {memberSince} &nbsp;
                    <span style={styles.verifiedBadge}>✅ Verified</span>
                  </div>
                </div>
              </div>
              <div style={styles.memberCard}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>⭐ Flashmart Member</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>You're saving more with exclusive offers!</div>
                <div style={{ fontSize: 20, marginTop: 8 }}>→</div>
              </div>
            </div>

            <div style={styles.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={styles.sectionTitle}>My Orders</div>
                <button style={styles.viewAll} onClick={() => setActivePage("orders")}>View All Orders →</button>
              </div>
              <div style={styles.statsGrid}>
                {[
                  { label: "Total Orders", value: orderStats.total,      color: "#1a3c34" },
                  { label: "Delivered",    value: orderStats.delivered,   color: "#2e7d52" },
                  { label: "Processing",   value: orderStats.processing,  color: "#e67e22" },
                  { label: "Cancelled",    value: orderStats.cancelled,   color: "#c0392b" },
                  { label: "Placed",       value: orderStats.placed,      color: "#2980b9" },
                ].map((s, i) => (
                  <div key={i} style={styles.statCard}>
                    <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
                    <div style={styles.statLabel}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>Account Settings</div>
              <div style={styles.settingsGrid}>
                {[
                  { icon: "👤", title: "Profile Information", sub: "Update your name, phone number & email" },
                  { icon: "📍", title: "Manage Addresses",    sub: "Add or edit your delivery addresses", action: () => setActiveTab("addresses") },
                ].map((s, i) => (
                  <button key={i} style={styles.settingCard} onClick={s.action || (() => {})}>
                    <div style={{ fontSize: 22 }}>{s.icon}</div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: "#777" }}>{s.sub}</div>
                    </div>
                    <div style={{ color: "#aaa" }}>›</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "addresses" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📍 Your Addresses</div>
            {addresses.length === 0 && <p style={{ color: "#888" }}>No addresses saved yet.</p>}
            {addresses.map((addr, i) => (
              <div key={i} style={styles.addrCard}>
                <strong>{addr.name}</strong> ({addr.phone})<br />
                {addr.line1}, {addr.city}<br />
                {addr.state} - {addr.pincode}
              </div>
            ))}
            <div style={{ ...styles.sectionTitle, marginTop: 20 }}>➕ Add New Address</div>
            {["name","phone","line1","city","state","pincode"].map(field => (
              <input key={field} placeholder={field.charAt(0).toUpperCase()+field.slice(1)}
                value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})}
                style={styles.input} />
            ))}
            <button style={styles.addBtn} onClick={handleAddAddress}>Add Address</button>
          </div>
        )}

        {activeTab === "orders" && (
          <div style={{ ...styles.section, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
            <button style={styles.addBtn} onClick={() => setActivePage("orders")}>View My Orders</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page:             { display: "flex", gap: 24, padding: "24px 32px", minHeight: "80vh", background: "#f7f7f7" },
  sidebar:          { width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 },
  sidebarTop:       { background: "#fff", borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 8, boxShadow: "0 1px 4px #0001" },
  avatar:           { width: 60, height: 60, borderRadius: "50%", background: "#1a3c34", color: "#fff", fontSize: 26, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" },
  sidebarName:      { fontWeight: 700, fontSize: 15 },
  sidebarEmail:     { fontSize: 12, color: "#888" },
  sidebarBtn:       { display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, width: "100%", textAlign: "left" },
  sidebarBtnActive: { background: "#e8f5ee", color: "#1a3c34", fontWeight: 600 },
  logoutBtn:        { display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, color: "#c0392b", marginTop: 4 },
  inviteCard:       { background: "#fff", borderRadius: 12, padding: 16, textAlign: "center", marginTop: 12, boxShadow: "0 1px 4px #0001" },
  inviteBtn:        { background: "#1a3c34", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 },
  content:          { flex: 1, display: "flex", flexDirection: "column", gap: 20 },
  profileHeader:    { background: "#fff", borderRadius: 12, padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px #0001" },
  bigAvatar:        { width: 80, height: 80, borderRadius: "50%", background: "#1a3c34", color: "#fff", fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  profileName:      { fontSize: 22, fontWeight: 700 },
  profileMeta:      { fontSize: 13, color: "#666", marginTop: 4 },
  verifiedBadge:    { background: "#e8f5ee", color: "#2e7d52", borderRadius: 4, padding: "2px 6px", fontSize: 12 },
  memberCard:       { background: "#f0f7f4", borderRadius: 12, padding: "16px 20px", minWidth: 220 },
  section:          { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" },
  sectionTitle:     { fontWeight: 700, fontSize: 16, marginBottom: 16 },
  statsGrid:        { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 },
  statCard:         { background: "#f7f7f7", borderRadius: 10, padding: "16px 10px", textAlign: "center" },
  statValue:        { fontSize: 26, fontWeight: 800 },
  statLabel:        { fontSize: 12, color: "#666", marginTop: 4 },
  settingsGrid:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  settingCard:      { display: "flex", alignItems: "center", gap: 12, padding: 16, border: "1px solid #eee", borderRadius: 10, background: "#fff", cursor: "pointer", width: "100%" },
  addrCard:         { background: "#f7f7f7", borderRadius: 8, padding: 14, marginBottom: 10, lineHeight: 1.7 },
  input:            { display: "block", width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginBottom: 10, fontSize: 14, boxSizing: "border-box" },
  addBtn:           { background: "#1a3c34", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 },
  viewAll:          { background: "none", border: "none", color: "#1a3c34", fontWeight: 600, cursor: "pointer", fontSize: 13 },
};

export default Profile;