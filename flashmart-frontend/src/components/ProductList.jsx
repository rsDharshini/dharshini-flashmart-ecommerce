// =============================================================================
// ProductList.jsx - Gromuse-style product listing with hero banner
// =============================================================================
import React, { useState, useEffect } from "react";
import ProductCard  from "./ProductCard";
import { productAPI } from "../api/api";

const CATEGORIES = ["All", "Dairy", "Bakery", "Beverages", "Fruits", "Snacks", "Grains"];

function ProductList({ userId, onCartUpdate, showToast, onProductSelect }) {
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy,         setSortBy]         = useState("default");

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true); setError(null);
    try {
      const data = await productAPI.getAll();
      setProducts(data.products || []);
    } catch {
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = products
    .filter(p => activeCategory === "All" || p.category === activeCategory)
    .sort((a, b) => {
      if (sortBy === "price-asc")  return (a.final_price || a.price) - (b.final_price || b.price);
      if (sortBy === "price-desc") return (b.final_price || b.price) - (a.final_price || a.price);
      if (sortBy === "name")       return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="page-container fade-in">

      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-tag">🔥 Limited time offer</div>
          <h1 className="hero-title">Get 10% Cashback<br />on Shopping ₹500+</h1>
          <p className="hero-subtitle">Fresh groceries delivered to your door in 15 minutes. Quality you can trust.</p>
          <span className="hero-btn">Shop Now →</span>
        </div>
        <div className="hero-emoji">🛒</div>
      </div>

      {/* Section header */}
      <div className="section-header">
        <h2 className="section-title">Flashmart / All category</h2>
        <span className="section-sub">{products.length} products available</span>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="category-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-btn ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="default">Sort by: Default</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name">Name: A to Z</option>
        </select>
      </div>

      {/* States */}
      {loading && (
        <div className="center-state">
          <div className="spinner" />
          <p>Loading products...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <span>⚠️ {error}</span>
          <button className="retry-btn" onClick={fetchProducts}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="center-state">
          <div className="empty-icon">🔍</div>
          <p>No products found in {activeCategory}</p>
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && (
        <div className="product-grid">
          {filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              userId={userId}
              onCartUpdate={onCartUpdate}
              showToast={showToast}
              onClick={onProductSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductList;