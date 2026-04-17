// =============================================================================
// ProductDetail.jsx - Full product detail page with similar products
// =============================================================================
import React, { useState, useEffect } from "react";
import { cartAPI, productAPI } from "../api/api";
import ProductCard from "./ProductCard";

function ProductDetail({ product, userId, onCartUpdate, showToast, onBack, onProductSelect }) {
  const [quantity, setQuantity] = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [added,    setAdded]    = useState(false);
  const [similar,  setSimilar]  = useState([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    productAPI.getAll()
      .then(d => {
        const all = d.products || [];
        const sim = all
          .filter(p => p.id !== product.id && p.category === product.category && p.is_active)
          .slice(0, 6);
        setSimilar(sim.length >= 2 ? sim : all.filter(p => p.id !== product.id && p.is_active).slice(0, 6));
      })
      .catch(() => {});
  }, [product.id]);

  const handleAdd = async () => {
    setLoading(true);
    try {
      await cartAPI.addItem(userId, product.id, quantity);
      setAdded(true);
      onCartUpdate(prev => prev + quantity);
      showToast(`${product.name} added to cart!`);
      setTimeout(() => setAdded(false), 2500);
    } catch {
      showToast("Failed to add to cart", "error");
    } finally {
      setLoading(false);
    }
  };

  const isOutOfStock = product.stock === 0;
  const stockStatus  = isOutOfStock ? "Out of stock" : product.stock < 5 ? `Only ${product.stock} left` : `${product.stock} units available`;
  const stockColor   = isOutOfStock ? "#e63946" : product.stock < 5 ? "#f4a261" : "#7ec94a";

  return (
    <div className="page-container fade-in">

      {/* Breadcrumb */}
      <div className="detail-breadcrumb">
        <span className="breadcrumb-link" onClick={onBack}>Home</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-link" onClick={onBack}>{product.category}</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{product.name}</span>
      </div>

      {/* Main detail layout */}
      <div className="detail-layout">

        {/* Image block */}
        <div className="detail-image-block">
          {product.stock > 0 && <div className="detail-free-badge">Free Delivery</div>}
          {product.discount_percentage > 0 && (
            <div className="detail-discount-badge">-{product.discount_percentage}%</div>
          )}
          <img
            className="detail-image"
            src={product.image_url || `https://via.placeholder.com/400x400/f0f7f0/2d6a4f?text=${encodeURIComponent(product.name)}`}
            alt={product.name}
            onError={e => { e.target.src = `https://via.placeholder.com/400x400/f0f7f0/2d6a4f?text=${encodeURIComponent(product.name[0])}`; }}
          />
        </div>

        {/* Info block */}
        <div className="detail-info">
          <div className="detail-brand">{product.brand}</div>
          <h1 className="detail-name">{product.name}</h1>

          <div className="detail-rating">
            <span className="stars">★★★★☆</span>
            <span className="rating-text">4.2 Rating (24 reviews)</span>
          </div>

          <div className="detail-price-row">
            {product.discount_percentage > 0 && (
              <span className="detail-original">₹{product.price}</span>
            )}
            <span className="detail-final">₹{product.final_price || product.price}</span>
          </div>

          <div className="detail-stock-row">
            <span style={{ fontSize: 20 }}>{isOutOfStock ? "❌" : product.stock < 5 ? "⚠️" : "✅"}</span>
            <span className="detail-stock-count" style={{ color: stockColor }}>{stockStatus}</span>
            <span className="detail-stock-label">· {product.unit}</span>
          </div>

          <p className="detail-desc">
            {product.description || `Fresh ${product.name} from ${product.brand}. Premium quality grocery product sourced directly. Category: ${product.category}. Available for fast delivery in your area.`}
          </p>

          {/* Tags */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[product.category, product.brand, product.unit].filter(Boolean).map(tag => (
              <span key={tag} style={{ padding: "4px 12px", background: "var(--green-pale)", color: "var(--green-main)", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          {!isOutOfStock && (
            <div className="detail-actions">
              <div className="detail-qty-box">
                <button className="detail-qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                <span className="detail-qty-val">{quantity}</span>
                <button className="detail-qty-btn" onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}>+</button>
              </div>
              <button
                className={`detail-add-btn ${added ? "added" : ""}`}
                onClick={handleAdd}
                disabled={loading || added}
              >
                {loading ? "Adding…" : added ? "✓ Added to Cart" : "🛒 Add to Cart"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Similar Products */}
      {similar.length > 0 && (
        <div className="similar-section">
          <div className="section-header">
            <h2 className="section-title">Similar products</h2>
            <span className="section-sub">{similar.length} items</span>
          </div>
          <div className="similar-grid">
            {similar.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                userId={userId}
                onCartUpdate={onCartUpdate}
                showToast={showToast}
                onClick={onProductSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;