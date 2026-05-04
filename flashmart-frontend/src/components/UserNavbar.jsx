import React, { useState, useRef, useEffect } from "react";
import { productAPI } from "../api/api";

const CATEGORY_ICONS = {
  Dairy: "🥛", Bakery: "🍞", Beverages: "🥤",
  Fruits: "🍎", Snacks: "🍿", Grains: "🌾",
};

function UserNavbar({ activePage, setActivePage, cartCount, onProductSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [allProds, setAllProds] = useState([]);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    productAPI.getAll().then(d => setAllProds(d.products || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const q = query.toLowerCase();
    const matched = allProds.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    ).slice(0, 5);
    setResults(matched);
    setOpen(true);
  }, [query, allProds]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const matchedCategories = query ? [...new Set(results.map(r => r.category))].slice(0, 2) : [];

  const highlight = (text) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<span className="search-highlight">{text.slice(idx, idx + query.length)}</span>{text.slice(idx + query.length)}</>;
  };

  const handleSelect = (product) => {
    setOpen(false); setQuery("");
    onProductSelect && onProductSelect(product);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => setActivePage("home")}>
        <span className="brand-icon">🛒</span>
        <span className="brand-name">Flashmart</span>
      </div>

      <div className="navbar-search">
        <input ref={inputRef} type="text" className="navbar-search-input"
          placeholder="Search groceries, brands, categories..."
          value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)} />
        <button className="navbar-search-btn">🔍</button>

        {open && (results.length > 0 || matchedCategories.length > 0) && (
          <div className="search-dropdown" ref={dropRef}>
            {results.length > 0 && (
              <>
                <div className="search-section-title">Products</div>
                {results.map(p => (
                  <div key={p.id} className="search-item" onClick={() => handleSelect(p)}>
                    <img className="search-item-img"
                      src={p.image_url || `https://source.unsplash.com/44x44/?${encodeURIComponent(p.name)},food`}
                      alt={p.name} onError={e => e.target.style.display = "none"} />
                    <div>
                      <div className="search-item-name">{highlight(p.name)}</div>
                      <div className="search-item-sub">{p.brand} · {p.category}</div>
                    </div>
                    <div className="search-item-price">₹{p.final_price || p.price}</div>
                  </div>
                ))}
              </>
            )}
            {matchedCategories.length > 0 && (
              <>
                {results.length > 0 && <div className="search-divider" />}
                <div className="search-section-title">Categories</div>
                {matchedCategories.map(cat => (
                  <div key={cat} className="search-cat-row"
                    onClick={() => { setOpen(false); setQuery(""); setActivePage("products"); }}>
                    <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{CATEGORY_ICONS[cat] || "🏷️"}</span>
                    <span>{highlight(cat)}</span>
                  </div>
                ))}
              </>
            )}
            {results.length > 0 && (
              <div className="search-view-all" onClick={() => { setOpen(false); setActivePage("products"); }}>
                View all results for "{query}" →
              </div>
            )}
          </div>
        )}
      </div>

      <div className="navbar-delivery">
        ⚡ Order now and get it within <strong>15 mins!</strong>
      </div>

      {/* USER links only — no Admin */}
      <div className="navbar-links">
        <button className={`nav-btn ${activePage==="products"?"active":""}`} onClick={() => setActivePage("products")}>Products</button>
        <button className={`nav-btn ${activePage==="cart"?"active":""}`} onClick={() => setActivePage("cart")}>
          Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
        <button className={`nav-btn ${activePage==="orders"?"active":""}`} onClick={() => setActivePage("orders")}>Orders</button>
        <button className={`nav-btn ${activePage==="address"?"active":""}`} onClick={() => setActivePage("address")}>Address</button>
      </div>

      <div className="navbar-user">
        <button className="nav-btn" onClick={() => { localStorage.clear(); setActivePage("login"); }}>Logout</button>
        <div className="user-avatar">U</div>
      </div>
    </nav>
  );
}

export default UserNavbar;