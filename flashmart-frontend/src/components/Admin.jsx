//=============================================================================
// Admin.jsx - Full Admin Dashboard with Logs (Fixed + Pagination + Excel)
// =============================================================================
import React, { useState, useEffect, useRef } from "react";
import { productAPI, orderAPI } from "../api/api";

const BASE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com/v1";
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

const CATEGORY_IMAGES = {
  Dairy: ["milk bottle", "fresh milk", "butter dairy", "cheese milk", "yogurt dairy"],
  Bakery: ["bread loaf", "brown bread", "whole wheat bread", "fresh bread"],
  Beverages: ["coca cola can", "cold drink bottle", "juice bottle", "soda can"],
  Fruits: ["red apple fruit", "fresh apple", "mango fruit", "banana fruit"],
  Snacks: ["potato chips", "lays chips", "snack packet", "crispy chips"],
  Grains: ["basmati rice", "rice grains", "wheat grains", "rice bag"],
};

const STATUS_COLORS = { PLACED: "#f59e0b", CONFIRMED: "#3b82f6", SHIPPED: "#8b5cf6", DELIVERED: "#10b981", CANCELLED: "#ef4444" };
const ALLOWED_TRANSITIONS = { PLACED: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
const LEVEL_COLORS = { INFO: "#3b82f6", WARN: "#f59e0b", ERROR: "#ef4444", DEBUG: "#6b7280" };
const LOGS_PER_PAGE = 50;

function Admin({ showToast }) {
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [bulkJson, setBulkJson] = useState("");
  const [bulkJsonError, setBulkJsonError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", description: "", category: "", brand: "", price: "", stock: "", unit: "kg", image_url: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef(null);
  const [productSearch, setProductSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStock, setFilterStock] = useState("all");

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [logCategory, setLogCategory] = useState("ALL");
  const [logPage, setLogPage] = useState(1);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (tab === "logs") fetchLogs(); }, [tab]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodData, ordersData, usersData] = await Promise.allSettled([
        productAPI.getAll(),
        fetch(`${BASE_URL}/orders`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${BASE_URL}/auth/users`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      if (prodData.status === "fulfilled") {
        const prods = prodData.value.products || [];
        setProducts(prods);
        setCategories([...new Set(prods.map(p => p.category).filter(Boolean))]);
      }
      if (ordersData.status === "fulfilled") setOrders(ordersData.value.orders || []);
      if (usersData.status === "fulfilled") setUsers(usersData.value.users || []);
    } catch { showToast("Error loading data", "error"); }
    finally { setLoading(false); }
  };

  // ── Logs: fetch with pagination param ──────────────────────────────────────
  const fetchLogs = async (page = 1) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/logs?limit=${LOGS_PER_PAGE}&page=${page}`, { headers: authHeaders() });
      const data = await res.json();
      setLogs(data.logs || []);
      setLogPage(page);
    } catch { showToast("Failed to load logs", "error"); }
    finally { setLogsLoading(false); }
  };

  // ── Download helpers ────────────────────────────────────────────────────────
  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const downloadLog = () => {
    const text = logs.map(l =>
      `[${new Date(l.timestamp).toLocaleString()}] [${l.level}] [${l.category || ""}] ${l.user || ""} — ${l.message}`
    ).join("\n");
    downloadFile(text, `flashmart-logs-${Date.now()}.log`, "text/plain");
  };

  const downloadJSON = () => downloadFile(JSON.stringify(logs, null, 2), `flashmart-logs-${Date.now()}.json`, "application/json");

  const downloadExcel = () => {
    const headers = ["Timestamp", "Level", "Category", "User", "Message"];
    const rows = logs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.level,
      l.category || "",
      l.user || "",
      `"${(l.message || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    downloadFile("\uFEFF" + csv, `flashmart-logs-${Date.now()}.xlsx`, "text/csv;charset=utf-8;");
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const lowStockProducts = products.filter(p => p.stock <= 10);
  const totalRevenue = orders.filter(o => o.status === "DELIVERED").reduce((s, o) => s + o.total_amount, 0);
  const pendingOrders = orders.filter(o => ["PLACED", "CONFIRMED"].includes(o.status)).length;

  const filteredProducts = products.filter(p => {
    const matchSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.brand?.toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = filterCategory === "All" || p.category === filterCategory;
    const matchStock = filterStock === "all" || (filterStock === "low" && p.stock <= 10) || (filterStock === "out" && p.stock === 0);
    return matchSearch && matchCat && matchStock;
  });

  const logCats = ["ALL", ...new Set(logs.map(l => l.category).filter(Boolean))];
  const filteredLogs = logs.filter(l => {
    const matchLevel = logFilter === "ALL" || l.level === logFilter;
    const matchCat = logCategory === "ALL" || l.category === logCategory;
    const matchSearch = !logSearch || l.message?.toLowerCase().includes(logSearch.toLowerCase()) || l.user?.toLowerCase().includes(logSearch.toLowerCase());
    return matchLevel && matchCat && matchSearch;
  });
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const pagedLogs = filteredLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggleActive = async (product) => {
    try { await productAPI.update(product.id, { is_active: !product.is_active }); showToast(`${product.name} ${!product.is_active ? "activated" : "deactivated"}`); await fetchAll(); }
    catch { showToast("Failed to update", "error"); }
  };

  const handleUpdateStatus = async (orderId, status) => {
    try { await orderAPI.updateStatus(orderId, status); showToast(`Order updated to ${status}`); await fetchAll(); }
    catch { showToast("Failed to update status", "error"); }
  };

  const handleAddProduct = async () => {
    const required = ["name", "description", "category", "brand", "price", "stock", "unit"];
    if (required.some(f => !addForm[f])) { showToast("Fill all required fields", "error"); return; }
    setAddLoading(true);
    try {
      await productAPI.create(addForm);
      showToast(`${addForm.name} added!`);
      setAddForm({ name: "", description: "", category: categories[0] || "", brand: "", price: "", stock: "", unit: "kg", image_url: "" });
      await fetchAll();
    } catch { showToast("Failed to add product", "error"); }
    finally { setAddLoading(false); }
  };

  const handleAddCategory = () => {
    const cat = newCategory.trim();
    if (!cat) return;
    if (categories.includes(cat)) { showToast("Already exists", "error"); return; }
    setCategories(prev => [...prev, cat]);
    setNewCategory("");
    showToast(`"${cat}" added! Save a product with this category to persist it.`);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product); setImagePreview(product.image_url || "");
    setImageUrl(product.image_url || ""); setSearchQuery(product.name);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 5 * 1024 * 1024) { showToast("Max 5MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = ev => { setImagePreview(ev.target.result); setImageUrl(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleSaveImage = async () => {
    if (!selectedProduct || !imageUrl) return;
    setUploadLoading(true);
    try {
      if (imageUrl.startsWith("data:image")) await productAPI.uploadImage(selectedProduct.id, imageUrl);
      else await productAPI.update(selectedProduct.id, { image_url: imageUrl });
      showToast(`Image saved for ${selectedProduct.name}!`);
      await fetchAll(); setSelectedProduct(null);
    } catch { showToast("Failed to save image", "error"); }
    finally { setUploadLoading(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <div className="spinner" /><p style={{ marginLeft: 12 }}>Loading dashboard...</p>
    </div>
  );

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>⚙️ Admin Dashboard</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Flashmart Control Panel</p>
        </div>
        <button onClick={fetchAll} style={btnStyle("#e0f2fe", "#0369a1")}>🔄 Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Products", value: products.length, icon: "📦", color: "#3b82f6" },
          { label: "Users", value: users.length, icon: "👥", color: "#8b5cf6" },
          { label: "Orders", value: orders.length, icon: "🧾", color: "#f59e0b" },
          { label: "Pending", value: pendingOrders, icon: "⏳", color: "#ef4444" },
          { label: "Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: "💰", color: "#10b981" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "2px solid #e5e7eb", overflowX: "auto" }}>
        {[
          { id: "overview", label: "📊 Overview" }, { id: "products", label: "📦 Products" },
          { id: "orders", label: "🧾 Orders" }, { id: "users", label: "👥 Users" },
          { id: "add", label: "➕ Add Product" }, { id: "bulk", label: "📋 Bulk Add" },
          { id: "images", label: "🖼️ Images" }, { id: "categories", label: "🏷️ Categories" },
          { id: "logs", label: "🖥️ Logs" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 16px", border: "none", borderBottom: tab === t.id ? "3px solid #1a3020" : "3px solid transparent",
            background: "none", cursor: "pointer", fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? "#1a3020" : "#6b7280", fontSize: 14, whiteSpace: "nowrap"
          }}>{t.label}</button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={cardStyle}>
            <h3 style={cardTitle}>⚠️ Low Stock ({lowStockProducts.length})</h3>
            {lowStockProducts.length === 0 ? <p style={{ color: "#6b7280" }}>All products well stocked ✅</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Product", "Category", "Stock"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{lowStockProducts.map(p => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{p.name}</td><td style={tdStyle}>{p.category}</td>
                    <td style={tdStyle}><span style={{ color: p.stock === 0 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>{p.stock}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div style={cardStyle}>
            <h3 style={cardTitle}>🕐 Recent Orders</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Order ID", "User", "Amount", "Status"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{orders.slice(0, 8).map(o => (
                <tr key={o.order_id}>
                  <td style={tdStyle}>{o.order_id.slice(0, 8)}...</td>
                  <td style={tdStyle}>{o.user_id.slice(0, 8)}...</td>
                  <td style={tdStyle}>₹{o.total_amount}</td>
                  <td style={tdStyle}><span style={{ background: STATUS_COLORS[o.status] + "22", color: STATUS_COLORS[o.status], padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{o.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={cardStyle}>
            <h3 style={cardTitle}>📊 Order Status Breakdown</h3>
            {["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"].map(s => {
              const count = orders.filter(o => o.status === s).length;
              const pct = orders.length ? Math.round(count / orders.length * 100) : 0;
              return (
                <div key={s} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s}</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ background: "#f3f4f6", borderRadius: 4, height: 8 }}>
                    <div style={{ background: STATUS_COLORS[s], width: `${pct}%`, height: 8, borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={cardStyle}>
            <h3 style={cardTitle}>🏷️ Products by Category</h3>
            {categories.map(cat => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 14 }}>{cat}</span>
                <span style={{ fontWeight: 700, color: "#1a3020" }}>{products.filter(p => p.category === cat).length} products</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PRODUCTS */}
      {tab === "products" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} style={inputStyle} />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterStock} onChange={e => setFilterStock(e.target.value)} style={inputStyle}>
              <option value="all">All Stock</option><option value="low">Low Stock (≤10)</option><option value="out">Out of Stock</option>
            </select>
            <span style={{ alignSelf: "center", color: "#6b7280", fontSize: 14, whiteSpace: "nowrap" }}>{filteredProducts.length} results</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>{["Image", "Name", "Category", "Brand", "Price", "Stock", "Status", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const isEditing = editingProductId === p.id;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={tdStyle}><img src={p.image_url || `https://source.unsplash.com/40x40/?${encodeURIComponent(p.name)},food`} alt={p.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} /></td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{isEditing ? <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, padding: "4px 8px" }} /> : p.name}</td>
                    <td style={tdStyle}>{isEditing ? <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, padding: "4px 8px" }}>{categories.map(c => <option key={c}>{c}</option>)}</select> : p.category}</td>
                    <td style={tdStyle}>{isEditing ? <input value={editForm.brand} onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))} style={{ ...inputStyle, padding: "4px 8px" }} /> : p.brand}</td>
                    <td style={tdStyle}>{isEditing ? <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} style={{ ...inputStyle, padding: "4px 8px", width: 80 }} /> : `₹${p.final_price || p.price}`}</td>
                    <td style={tdStyle}>{isEditing ? <input type="number" value={editForm.stock} onChange={e => setEditForm(f => ({ ...f, stock: e.target.value }))} style={{ ...inputStyle, padding: "4px 8px", width: 70 }} /> : <span style={{ color: p.stock === 0 ? "#ef4444" : p.stock <= 10 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>{p.stock}</span>}</td>
                    <td style={tdStyle}><span style={{ background: p.is_active ? "#dcfce7" : "#fee2e2", color: p.is_active ? "#16a34a" : "#dc2626", padding: "2px 8px", borderRadius: 20, fontSize: 12 }}>{p.is_active ? "Active" : "Inactive"}</span></td>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <>
                          <button onClick={async () => { try { await productAPI.update(p.id, editForm); showToast("Updated!"); setEditingProductId(null); await fetchAll(); } catch { showToast("Update failed", "error"); } }} style={{ ...btnStyle("#dcfce7", "#16a34a"), fontSize: 12, padding: "4px 10px" }}>Save</button>
                          <button onClick={() => setEditingProductId(null)} style={{ ...btnStyle("#fee2e2", "#dc2626"), fontSize: 12, padding: "4px 10px", marginLeft: 6 }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingProductId(p.id); setEditForm({ ...p }); }} style={{ ...btnStyle("#e0f2fe", "#0369a1"), fontSize: 12, padding: "4px 10px" }}>Edit</button>
                          <button onClick={() => handleToggleActive(p)} style={{ ...btnStyle(p.is_active ? "#fee2e2" : "#dcfce7", p.is_active ? "#dc2626" : "#16a34a"), fontSize: 12, padding: "4px 10px", marginLeft: 6 }}>{p.is_active ? "Deactivate" : "Activate"}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: ORDERS */}
      {tab === "orders" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <thead style={{ background: "#f9fafb" }}><tr>{["Order ID", "User ID", "Items", "Amount", "Status", "Date", "Update Status"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.order_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{o.order_id.slice(0, 12)}...</code></td>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{o.user_id.slice(0, 12)}...</code></td>
                <td style={tdStyle}>{o.items?.length || 0}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>₹{o.total_amount}</td>
                <td style={tdStyle}><span style={{ background: STATUS_COLORS[o.status] + "22", color: STATUS_COLORS[o.status], padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{o.status}</span></td>
                <td style={tdStyle}>{new Date(o.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  {ALLOWED_TRANSITIONS[o.status]?.length > 0 ? (
                    <select onChange={e => e.target.value && handleUpdateStatus(o.order_id, e.target.value)} defaultValue="" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
                      <option value="">Change...</option>
                      {ALLOWED_TRANSITIONS[o.status].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* TAB: USERS */}
      {tab === "users" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <thead style={{ background: "#f9fafb" }}><tr>{["User ID", "Email", "Role", "Joined"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.userId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{u.userId.slice(0, 16)}...</code></td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{u.email}</td>
                <td style={tdStyle}><span style={{ background: u.role === "admin" ? "#fef3c7" : "#eff6ff", color: u.role === "admin" ? "#d97706" : "#3b82f6", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{u.role}</span></td>
                <td style={tdStyle}>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* TAB: ADD PRODUCT */}
      {tab === "add" && (
        <div style={cardStyle}>
          <h3 style={cardTitle}>➕ Add New Product</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Product Name *", field: "name", placeholder: "e.g. Amul Gold Milk" },
              { label: "Brand *", field: "brand", placeholder: "e.g. Amul" },
              { label: "Price (₹) *", field: "price", placeholder: "e.g. 65", type: "number" },
              { label: "Stock *", field: "stock", placeholder: "e.g. 100", type: "number" },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field}>
                <label style={labelStyle}>{label}</label>
                <input type={type || "text"} placeholder={placeholder} value={addForm[field]} onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Category *</label>
              <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Unit *</label>
              <select value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                {["kg", "g", "L", "ml", "piece", "pack", "dozen", "box"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Description *</label>
              <textarea placeholder="Product description..." value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Image URL (optional)</label>
              <input placeholder="https://..." value={addForm.image_url} onChange={e => setAddForm(f => ({ ...f, image_url: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <button onClick={handleAddProduct} disabled={addLoading} style={{ ...btnStyle("#1a3020", "#fff"), marginTop: 20, padding: "12px 32px" }}>
            {addLoading ? "Adding..." : "➕ Add Product"}
          </button>
        </div>
      )}

      {/* TAB: BULK ADD */}
      {tab === "bulk" && (
        <div style={cardStyle}>
          <h3 style={cardTitle}>📋 Bulk Add via JSON</h3>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
            Paste a JSON array. Required: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>name, brand, category, unit, price, stock, description</code>
          </p>
          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "#6b7280", fontWeight: 600 }}>📄 Show example JSON</summary>
            <pre style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, fontSize: 12, overflowX: "auto", marginTop: 8 }}>{`[
  { "name": "Amul Gold Milk", "brand": "Amul", "category": "Dairy", "unit": "L", "price": 65, "stock": 100, "description": "Full cream milk" },
  { "name": "Brown Bread", "brand": "Britannia", "category": "Bakery", "unit": "pack", "price": 40, "stock": 50, "description": "Whole wheat brown bread" }
]`}</pre>
          </details>
          <textarea value={bulkJson} onChange={e => { setBulkJson(e.target.value); setBulkJsonError(""); }}
            placeholder='[{"name": "...", "brand": "...", ...}]' rows={16}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, resize: "vertical", marginBottom: 8 }} spellCheck={false} />
          {bulkJsonError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>❌ {bulkJsonError}</div>}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button disabled={bulkLoading} onClick={async () => {
              let parsed;
              try { parsed = JSON.parse(bulkJson); } catch (e) { setBulkJsonError(`Invalid JSON: ${e.message}`); return; }
              if (!Array.isArray(parsed)) { setBulkJsonError("JSON must be an array [ ... ]"); return; }
              const required = ["name", "brand", "category", "unit", "price", "stock", "description"];
              const invalid = parsed.map((r, i) => { const missing = required.filter(f => !r[f] && r[f] !== 0); return missing.length ? `Row ${i + 1}: missing ${missing.join(", ")}` : null; }).filter(Boolean);
              if (invalid.length) { setBulkJsonError(invalid.slice(0, 3).join(" | ") + (invalid.length > 3 ? ` ...+${invalid.length - 3} more` : "")); return; }
              setBulkLoading(true);
              let success = 0, fail = 0;
              for (const row of parsed) { try { await productAPI.create(row); success++; } catch { fail++; } }
              setBulkLoading(false);
              showToast(`Added ${success} products${fail ? `, ${fail} failed` : ""}`, fail ? "error" : "success");
              if (!fail) { setBulkJson(""); setBulkJsonError(""); }
              await fetchAll();
            }} style={{ ...btnStyle("#1a3020", "#fff"), padding: "12px 32px" }}>{bulkLoading ? "Adding..." : "✅ Upload JSON"}</button>
            <button onClick={() => { setBulkJson(""); setBulkJsonError(""); }} style={btnStyle("#fee2e2", "#dc2626")}>🗑️ Clear</button>
            {bulkJson && (() => { try { const arr = JSON.parse(bulkJson); return Array.isArray(arr) ? <span style={{ fontSize: 13, color: "#6b7280" }}>{arr.length} product{arr.length !== 1 ? "s" : ""} detected</span> : null; } catch { return null; } })()}
          </div>
        </div>
      )}

      {/* TAB: IMAGES */}
      {tab === "images" && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
          <div style={cardStyle}>
            <h3 style={cardTitle}>Select Product</h3>
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {products.map(p => (
                <div key={p.id} onClick={() => handleSelectProduct(p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderRadius: 8, background: selectedProduct?.id === p.id ? "#f0fdf4" : "transparent", marginBottom: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.image_url ? "#10b981" : "#f59e0b", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: selectedProduct?.id === p.id ? 600 : 400 }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            {!selectedProduct ? (
              <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
                <p>Select a product to set its image</p>
              </div>
            ) : (
              <>
                <h3 style={cardTitle}>Setting image for: <strong>{selectedProduct.name}</strong></h3>
                <div style={{ width: 160, height: 160, border: "2px dashed #d1d5db", borderRadius: 12, overflow: "hidden", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {imagePreview ? <img src={imagePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => e.target.style.display = "none"} /> : <span style={{ color: "#9ca3af" }}>No preview</span>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>📁 Upload from computer</label>
                  <button onClick={() => fileRef.current.click()} style={btnStyle("#f3f4f6", "#374151")}>Choose File (max 5MB)</button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>🔗 Paste image URL</label>
                  <input type="text" placeholder="https://..." value={imageUrl.startsWith("data:") ? "" : imageUrl} onChange={e => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>🆓 Unsplash search</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input type="text" placeholder={`Search e.g. "${selectedProduct.name} food"`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => { const url = `https://source.unsplash.com/400x400/?${encodeURIComponent(searchQuery)},food`; setImageUrl(url); setImagePreview(url); }} style={btnStyle("#1a3020", "#fff")}>Use</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(CATEGORY_IMAGES[selectedProduct.category] || []).map(q => (
                      <button key={q} onClick={() => { const url = `https://source.unsplash.com/400x400/?${encodeURIComponent(q)},food`; setImageUrl(url); setImagePreview(url); }} style={{ ...btnStyle("#f3f4f6", "#374151"), fontSize: 12, padding: "4px 10px" }}>{q}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSaveImage} disabled={uploadLoading || !imageUrl} style={{ ...btnStyle("#1a3020", "#fff"), padding: "12px 32px" }}>
                  {uploadLoading ? "Saving..." : "✅ Save Image"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: CATEGORIES */}
      {tab === "categories" && (
        <div style={cardStyle}>
          <h3 style={cardTitle}>🏷️ Manage Categories</h3>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>Categories are derived from your products. Adding here is temporary — becomes permanent once a product with that category is saved.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input placeholder="New category name..." value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategory()} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleAddCategory} style={btnStyle("#1a3020", "#fff")}>Add Category</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {categories.map(cat => (
              <div key={cat} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{cat}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{products.filter(p => p.category === cat).length} products</div>
                </div>
                <button onClick={() => setCategories(prev => prev.filter(c => c !== cat))} style={{ ...btnStyle("#fee2e2", "#dc2626"), fontSize: 12, padding: "4px 10px" }}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: LOGS */}
      {tab === "logs" && (
        <div style={cardStyle}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={cardTitle}>🖥️ Application Logs ({filteredLogs.length})</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => fetchLogs(logPage)} disabled={logsLoading} style={btnStyle("#e0f2fe", "#0369a1")}>
                {logsLoading ? "Loading..." : "🔄 Refresh"}
              </button>
              <button onClick={downloadLog} style={btnStyle("#f0fdf4", "#16a34a")}>⬇️ .log</button>
              <button onClick={downloadJSON} style={btnStyle("#fef3c7", "#d97706")}>⬇️ .json</button>
              <button onClick={downloadExcel} style={btnStyle("#f0fdf4", "#16a34a")}>⬇️ .xlsx</button>
              <button onClick={() => { setLogs([]); }} style={btnStyle("#fee2e2", "#dc2626")}>🗑️ Clear</button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search logs..." value={logSearch} onChange={e => { setLogSearch(e.target.value); setLogPage(1); }} style={{ ...inputStyle, maxWidth: 220 }} />
            <select value={logFilter} onChange={e => { setLogFilter(e.target.value); setLogPage(1); }} style={{ ...inputStyle, width: "auto" }}>
              {["ALL", "INFO", "WARN", "ERROR", "DEBUG"].map(l => <option key={l}>{l}</option>)}
            </select>
            <select value={logCategory} onChange={e => { setLogCategory(e.target.value); setLogPage(1); }} style={{ ...inputStyle, width: "auto" }}>
              {logCats.map(c => <option key={c}>{c}</option>)}
            </select>
            {["ERROR", "WARN", "INFO", "DEBUG"].map(lv => (
              <span key={lv} style={{ fontSize: 12, fontWeight: 700, color: LEVEL_COLORS[lv] }}>
                {lv}: {logs.filter(l => l.level === lv).length}
              </span>
            ))}
          </div>

          {/* Terminal */}
          <div style={{ fontFamily: "monospace", fontSize: 12, maxHeight: 520, overflowY: "auto", border: "1px solid #1e293b", borderRadius: 10, background: "#0f172a" }}>
            {logsLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading logs...</div>
            ) : pagedLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>No logs found</div>
            ) : pagedLogs.map(l => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "175px 52px 85px 130px 1fr", gap: 8, padding: "5px 14px", borderBottom: "1px solid #1e293b" }}>
                <span style={{ color: "#475569" }}>{new Date(l.timestamp).toLocaleString()}</span>
                <span style={{ color: LEVEL_COLORS[l.level], fontWeight: 700 }}>{l.level}</span>
                <span style={{ color: "#64748b" }}>[{l.category}]</span>
                <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.user}</span>
                <span style={{ color: l.level === "ERROR" ? "#fca5a5" : l.level === "WARN" ? "#fcd34d" : "#cbd5e1", wordBreak: "break-word" }}>{l.message}</span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalLogPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button onClick={() => setLogPage(1)} disabled={logPage === 1} style={btnStyle("#f3f4f6", "#374151")}>««</button>
              <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1} style={btnStyle("#f3f4f6", "#374151")}>‹ Prev</button>
              <span style={{ fontSize: 13, color: "#6b7280", padding: "0 8px" }}>
                Page <strong>{logPage}</strong> of <strong>{totalLogPages}</strong>
                &nbsp;({filteredLogs.length} logs)
              </span>
              <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages} style={btnStyle("#f3f4f6", "#374151")}>Next ›</button>
              <button onClick={() => setLogPage(totalLogPages)} disabled={logPage === totalLogPages} style={btnStyle("#f3f4f6", "#374151")}>»»</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shared styles
const cardStyle = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24 };
const cardTitle = { margin: "0 0 16px", fontSize: 16, fontWeight: 700 };
const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle = { padding: "10px 14px", fontSize: 14 };
const inputStyle = { width: "100%", padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };
const btnStyle = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 });

export default Admin;