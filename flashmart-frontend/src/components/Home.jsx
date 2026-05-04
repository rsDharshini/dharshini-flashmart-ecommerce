// =============================================================================
// Home.jsx - Zepto-style home page, fully dynamic categories
// =============================================================================
import React, { useState, useEffect, useRef } from "react";
import ProductCard from "./ProductCard";
import { productAPI } from "../api/api";

const CATEGORY_EMOJI = {
  Dairy: "🥛", Bakery: "🍞", Beverages: "🥤",
  Fruits: "🍎", Snacks: "🍿", Grains: "🌾",
};
const DEFAULT_EMOJI = "🏷️";

// ── Single horizontal category row ───────────────────────────────────────────
function CategoryRow({ name, emoji, products, userId, onCartUpdate, showToast, onProductSelect, onSeeAll }) {
  const rowRef = useRef(null);
  const scroll = (dir) => rowRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  if (!products.length) return null;

  return (
    <div className="home-category-section">
      <div className="home-category-header">
        <div className="home-category-title-group">
          <span className="home-category-emoji">{emoji}</span>
          <h2 className="home-category-title">{name}</h2>
        </div>
        <button className="home-see-all-btn" onClick={() => onSeeAll(name)}>
          See All <span className="home-see-all-arrow">→</span>
        </button>
      </div>

      <div className="home-row-wrapper">
        <button className="home-scroll-btn home-scroll-left" onClick={() => scroll(-1)}>‹</button>
        <div className="home-products-row" ref={rowRef}>
          {products.map(product => (
            <div className="home-card-wrapper" key={product.id}>
              <ProductCard
                product={product}
                userId={userId}
                onCartUpdate={onCartUpdate}
                showToast={showToast}
                onClick={onProductSelect}
              />
            </div>
          ))}
        </div>
        <button className="home-scroll-btn home-scroll-right" onClick={() => scroll(1)}>›</button>
      </div>
    </div>
  );
}

// ── Main Home Component ───────────────────────────────────────────────────────
function Home({ userId, onCartUpdate, showToast, onProductSelect, setActivePage, setActiveCategory }) {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]); // ✅ dynamic
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true); setError(null);
    try {
      const data = await productAPI.getAll();
      const prods = data.products || [];
      setProducts(prods);

      // ✅ Derive unique categories from products
      const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
      setCategories(cats);
    } catch {
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Group products by category, limit to 8 per row
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = products.filter(p => p.category === cat).slice(0, 8);
    return acc;
  }, {});

  const handleSeeAll = (cat) => {
    if (setActiveCategory) setActiveCategory(cat);
    setActivePage("products");
  };

  return (
    <div className="home-page fade-in">

      {/* ── Hero Banner ── */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-tag">🔥 Limited time offer</div>
          <h1 className="hero-title">
            Get 10% Cashback<br />on Shopping ₹500+
          </h1>
          <p className="hero-subtitle">
            Fresh groceries delivered to your door in 15 minutes.<br />
            Quality you can trust.
          </p>
          <button className="hero-btn" onClick={() => setActivePage("home")}>
            Shop Now →
          </button>
        </div>
        <div className="hero-emoji">🛒</div>
      </div>

      {/* ── Category Quick Links — dynamic ── */}
      {!loading && categories.length > 0 && (
        <div className="home-quick-links">
          {categories.map(cat => (
            <button
              key={cat}
              className="home-quick-link-btn"
              onClick={() => handleSeeAll(cat)}
            >
              <span className="home-quick-link-emoji">{CATEGORY_EMOJI[cat] || DEFAULT_EMOJI}</span>
              <span className="home-quick-link-name">{cat}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="center-state">
          <div className="spinner" />
          <p>Loading products...</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="error-state">
          <span>⚠️ {error}</span>
          <button className="retry-btn" onClick={fetchProducts}>Retry</button>
        </div>
      )}

      {/* ── Category Rows — one per unique category ── */}
      {!loading && !error && (
        <div className="home-categories-container">
          {categories.map(cat => (
            <CategoryRow
              key={cat}
              name={cat}
              emoji={CATEGORY_EMOJI[cat] || DEFAULT_EMOJI}
              products={grouped[cat] || []}
              userId={userId}
              onCartUpdate={onCartUpdate}
              showToast={showToast}
              onProductSelect={onProductSelect}
              onSeeAll={handleSeeAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;