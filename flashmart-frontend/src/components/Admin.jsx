// =============================================================================
// Admin.jsx - Admin Panel with product management + image upload
// =============================================================================
import React, { useState, useEffect, useRef } from "react";
import { productAPI } from "../api/api";

// Free stock image suggestions per category using Unsplash
const CATEGORY_IMAGES = {
  Dairy:     ["milk bottle", "fresh milk", "dairy milk", "amul milk", "butter dairy", "cheese milk", "yogurt dairy", "cream milk"],
  Bakery:    ["bread loaf", "brown bread", "whole wheat bread", "fresh bread", "bakery bread", "toast bread"],
  Beverages: ["coca cola can", "cold drink bottle", "juice bottle", "beverage drink", "soda can", "water bottle"],
  Fruits:    ["red apple fruit", "fresh apple", "mango fruit", "banana fruit", "orange fruit", "fresh fruits"],
  Snacks:    ["potato chips", "lays chips", "snack packet", "crispy chips", "biscuit snack"],
  Grains:    ["basmati rice", "rice grains", "wheat grains", "rice bag", "india gate rice"],
};

const FREE_IMAGE_SOURCES = [
  { name: "Unsplash",   urlFn: (q) => `https://source.unsplash.com/400x400/?${encodeURIComponent(q)},food,grocery` },
  { name: "Picsum",     urlFn: (q) => `https://picsum.photos/seed/${encodeURIComponent(q)}/400/400` },
];

function Admin({ showToast }) {
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab,      setActiveTab]      = useState("products"); // products | upload | add
  const [uploadLoading,  setUploadLoading]  = useState(false);
  const [imagePreview,   setImagePreview]   = useState("");
  const [imageUrl,       setImageUrl]       = useState("");
  const [suggestions,    setSuggestions]    = useState([]);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [addForm,        setAddForm]        = useState({ name: "", description: "", category: "Dairy", brand: "", price: "", stock: "", unit: "kg", image_url: "" });
  const [addLoading,     setAddLoading]     = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await productAPI.getAll();
      setProducts(data.products || []);
    } catch { showToast("Failed to load products", "error"); }
    finally  { setLoading(false); }
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setImagePreview(product.image_url || "");
    setImageUrl(product.image_url || "");
    setSuggestions(CATEGORY_IMAGES[product.category] || []);
    setSearchQuery(product.name);
    setActiveTab("upload");
  };

  // ── File upload (converts to base64) ──────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("File too large. Max 5MB.", "error"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      setImageUrl(ev.target.result); // base64 for upload
    };
    reader.readAsDataURL(file);
  };

  // ── Use a free Unsplash URL directly ──────────────────────────────────────
  const handleUseFreeImage = (query) => {
    const url = `https://source.unsplash.com/400x400/?${encodeURIComponent(query)},food,grocery,product`;
    setImagePreview(url);
    setImageUrl(url);
    showToast(`Image set: "${query}" from Unsplash`);
  };

  // ── Custom URL input ───────────────────────────────────────────────────────
  const handleUrlInput = (url) => {
    setImageUrl(url);
    setImagePreview(url);
  };

  // ── Save image URL to product ──────────────────────────────────────────────
  const handleSaveImage = async () => {
    if (!selectedProduct || !imageUrl) return;
    setUploadLoading(true);
    try {
      // If it's a base64 image, use upload-image endpoint
      if (imageUrl.startsWith("data:image")) {
        await productAPI.uploadImage(selectedProduct.id, imageUrl);
        showToast(`Image uploaded for ${selectedProduct.name}!`);
      } else {
        // It's a URL — update product directly
        await productAPI.update(selectedProduct.id, { image_url: imageUrl });
        showToast(`Image URL saved for ${selectedProduct.name}!`);
      }
      await fetchProducts();
      setActiveTab("products");
      setSelectedProduct(null);
    } catch {
      showToast("Failed to save image", "error");
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Add new product ────────────────────────────────────────────────────────
  const handleAddProduct = async () => {
    const required = ["name", "description", "category", "brand", "price", "stock", "unit"];
    const missing  = required.filter(f => !addForm[f]);
    if (missing.length) { showToast(`Missing: ${missing.join(", ")}`, "error"); return; }
    setAddLoading(true);
    try {
      await productAPI.create(addForm);
      showToast(`${addForm.name} added successfully!`);
      setAddForm({ name: "", description: "", category: "Dairy", brand: "", price: "", stock: "", unit: "kg", image_url: "" });
      await fetchProducts();
      setActiveTab("products");
    } catch {
      showToast("Failed to add product", "error");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Toggle product active/inactive ────────────────────────────────────────
  const handleToggleActive = async (product) => {
    try {
      await productAPI.update(product.id, { is_active: !product.is_active });
      showToast(`${product.name} ${!product.is_active ? "activated" : "deactivated"}`);
      await fetchProducts();
    } catch {
      showToast("Failed to update product", "error");
    }
  };

  return (
    <div className="page-container fade-in">

      {/* Admin Header */}
      <div className="admin-header">
        <div>
          <h1 className="page-title">⚙️ Admin Panel</h1>
          <p className="page-subtitle">{products.length} products in catalogue</p>
        </div>
        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === "products" ? "active" : ""}`} onClick={() => setActiveTab("products")}>📦 Products</button>
          <button className={`admin-tab ${activeTab === "upload"   ? "active" : ""}`} onClick={() => setActiveTab("upload")}>🖼️ Images</button>
          <button className={`admin-tab ${activeTab === "add"      ? "active" : ""}`} onClick={() => setActiveTab("add")}>➕ Add Product</button>
        </div>
      </div>

      {/* ── TAB: Products ── */}
      {activeTab === "products" && (
        <div className="admin-products-grid">
          {loading ? (
            <div className="center-state"><div className="spinner" /><p>Loading...</p></div>
          ) : (
            products.map(product => (
              <div key={product.id} className={`admin-product-card ${!product.is_active ? "inactive" : ""}`}>
                <div className="admin-product-img-wrap">
                  <img
                    src={product.image_url || `https://source.unsplash.com/120x120/?${encodeURIComponent(product.name)},food`}
                    alt={product.name}
                    onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}/120/120`; }}
                  />
                  {!product.is_active && <div className="admin-inactive-overlay">INACTIVE</div>}
                </div>
                <div className="admin-product-info">
                  <div className="admin-product-name">{product.name}</div>
                  <div className="admin-product-meta">{product.category} · {product.brand}</div>
                  <div className="admin-product-meta">₹{product.final_price} · Stock: {product.stock}</div>
                  {product.image_url
                    ? <div className="admin-has-image">✅ Has image</div>
                    : <div className="admin-no-image">⚠️ No image</div>
                  }
                </div>
                <div className="admin-product-actions">
                  <button className="admin-btn-image" onClick={() => handleSelectProduct(product)}>🖼️ Set Image</button>
                  <button
                    className={`admin-btn-toggle ${product.is_active ? "deactivate" : "activate"}`}
                    onClick={() => handleToggleActive(product)}
                  >
                    {product.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Image Upload ── */}
      {activeTab === "upload" && (
        <div className="admin-upload-layout">

          {/* Left — Product selector */}
          <div className="admin-upload-sidebar">
            <h3 className="admin-section-title">Select Product</h3>
            <div className="admin-product-list">
              {products.map(p => (
                <div
                  key={p.id}
                  className={`admin-product-list-item ${selectedProduct?.id === p.id ? "selected" : ""}`}
                  onClick={() => handleSelectProduct(p)}
                >
                  <div className="admin-list-dot" style={{ background: p.image_url ? "#7ec94a" : "#f4a261" }} />
                  <span>{p.name}</span>
                  <span className="admin-list-cat">{p.category}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Image picker */}
          <div className="admin-upload-main">
            {!selectedProduct ? (
              <div className="center-state">
                <div style={{ fontSize: 48 }}>🖼️</div>
                <p>Select a product from the left to set its image</p>
              </div>
            ) : (
              <>
                <h3 className="admin-section-title">Setting image for: <strong>{selectedProduct.name}</strong></h3>

                {/* Preview */}
                <div className="admin-preview-box">
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="admin-preview-img"
                      onError={e => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="admin-preview-placeholder">No image selected</div>
                  )}
                </div>

                {/* Option 1 — Upload from computer */}
                <div className="admin-option-block">
                  <div className="admin-option-title">📁 Option 1 — Upload from your computer</div>
                  <button className="admin-file-btn" onClick={() => fileRef.current.click()}>
                    Choose Image File (JPG, PNG, WebP — max 5MB)
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                </div>

                {/* Option 2 — Paste URL */}
                <div className="admin-option-block">
                  <div className="admin-option-title">🔗 Option 2 — Paste image URL</div>
                  <div className="admin-url-row">
                    <input
                      type="text"
                      className="admin-url-input"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl.startsWith("data:") ? "" : imageUrl}
                      onChange={e => handleUrlInput(e.target.value)}
                    />
                    <button className="admin-url-preview-btn" onClick={() => setImagePreview(imageUrl)}>Preview</button>
                  </div>
                </div>

                {/* Option 3 — Free stock images */}
                <div className="admin-option-block">
                  <div className="admin-option-title">🆓 Option 3 — Free stock images (Unsplash)</div>
                  <div className="admin-search-row">
                    <input
                      type="text"
                      className="admin-url-input"
                      placeholder={`Search e.g. "${selectedProduct.name} food"`}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <button className="admin-url-preview-btn" onClick={() => handleUseFreeImage(searchQuery)}>
                      Use This
                    </button>
                  </div>

                  <div className="admin-suggestions-title">Quick suggestions for {selectedProduct.category}:</div>
                  <div className="admin-suggestions">
                    {(CATEGORY_IMAGES[selectedProduct.category] || []).map(query => (
                      <button key={query} className="admin-suggestion-chip" onClick={() => handleUseFreeImage(query)}>
                        {query}
                      </button>
                    ))}
                  </div>

                  <div className="admin-unsplash-note">
                    ℹ️ Unsplash provides free high-quality photos. Each click loads a relevant food/product image.
                  </div>
                </div>

                {/* Save button */}
                <button
                  className="admin-save-btn"
                  onClick={handleSaveImage}
                  disabled={uploadLoading || !imageUrl}
                >
                  {uploadLoading ? "Saving..." : "✅ Save Image"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Add Product ── */}
      {activeTab === "add" && (
        <div className="admin-add-form">
          <h3 className="admin-section-title">Add New Product</h3>

          <div className="admin-form-grid">
            <div className="admin-form-group">
              <label>Product Name *</label>
              <input type="text" placeholder="e.g. Amul Gold Milk" value={addForm.name} onChange={e => setAddForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div className="admin-form-group">
              <label>Brand *</label>
              <input type="text" placeholder="e.g. Amul" value={addForm.brand} onChange={e => setAddForm(f => ({...f, brand: e.target.value}))} />
            </div>
            <div className="admin-form-group">
              <label>Category *</label>
              <select value={addForm.category} onChange={e => setAddForm(f => ({...f, category: e.target.value}))}>
                {["Dairy","Bakery","Beverages","Fruits","Snacks","Grains"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label>Unit *</label>
              <select value={addForm.unit} onChange={e => setAddForm(f => ({...f, unit: e.target.value}))}>
                {["kg","g","L","ml","piece","pack","dozen","box"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label>Price (₹) *</label>
              <input type="number" placeholder="e.g. 65" value={addForm.price} onChange={e => setAddForm(f => ({...f, price: e.target.value}))} />
            </div>
            <div className="admin-form-group">
              <label>Stock *</label>
              <input type="number" placeholder="e.g. 100" value={addForm.stock} onChange={e => setAddForm(f => ({...f, stock: e.target.value}))} />
            </div>
            <div className="admin-form-group full-width">
              <label>Description *</label>
              <textarea placeholder="e.g. Fresh full cream milk from Amul. Rich in calcium and protein." value={addForm.description} onChange={e => setAddForm(f => ({...f, description: e.target.value}))} rows={3} />
            </div>
            <div className="admin-form-group full-width">
              <label>Image URL (optional)</label>
              <input type="text" placeholder="https://... or leave blank to set later" value={addForm.image_url} onChange={e => setAddForm(f => ({...f, image_url: e.target.value}))} />
              {addForm.image_url && (
                <img src={addForm.image_url} alt="preview" style={{ marginTop: 10, width: 100, height: 100, objectFit: "contain", borderRadius: 10, border: "1px solid #e4ebe6" }}
                  onError={e => e.target.style.display = "none"} />
              )}
            </div>
          </div>

          <button className="admin-save-btn" onClick={handleAddProduct} disabled={addLoading}>
            {addLoading ? "Adding..." : "➕ Add Product"}
          </button>
        </div>
      )}
    </div>
  );
}

export default Admin;