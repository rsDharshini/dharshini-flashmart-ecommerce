// =============================================================================
// ProductCard.jsx - Compact card
// =============================================================================
import React, { useState } from "react";
import { cartAPI } from "../api/api";

function ProductCard({ product, userId, onCartUpdate, showToast, onClick }) {
  const [loading,  setLoading]  = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added,    setAdded]    = useState(false);

  const isOutOfStock = product.stock === 0;

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    setLoading(true);
    try {
      await cartAPI.addItem(userId, product.id, quantity);
      setAdded(true);
      onCartUpdate(prev => prev + quantity);
      showToast(`${product.name} added to cart!`);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      showToast("Failed to add to cart", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQty = (e, delta) => {
    e.stopPropagation();
    setQuantity(q => Math.max(1, Math.min(product.stock, q + delta)));
  };

  return (
    <div
      className={`product-card compact-card ${isOutOfStock ? "out-of-stock" : ""}`}
      onClick={() => onClick && onClick(product)}
    >
      {/* Image */}
      <div className="compact-img-wrapper">
        <img
          src={product.image_url || `https://via.placeholder.com/160x160/f0f7f0/2d6a4f?text=${encodeURIComponent(product.name)}`}
          alt={product.name}
          className="compact-img"
          onError={e => { e.target.src = `https://via.placeholder.com/160x160/f0f7f0/2d6a4f?text=${encodeURIComponent(product.name[0])}`; }}
        />
        {isOutOfStock && <div className="out-of-stock-overlay">Out of Stock</div>}
        {product.discount_percentage > 0 && (
          <div className="discount-badge">-{product.discount_percentage}%</div>
        )}
      </div>

      {/* Info */}
      <div className="compact-info">
        <div className="product-category">{product.category}</div>
        <h3 className="compact-name">{product.name}</h3>
        <p className="compact-brand">{product.brand} · 500g</p>

        <div className="compact-bottom">
          <div className="compact-price">
            {product.discount_percentage > 0 && (
              <span className="original-price">₹{product.price}</span>
            )}
            <span className="final-price">₹{product.final_price || product.price}</span>
          </div>
          <span className={`compact-stock ${isOutOfStock ? "out" : product.stock < 5 ? "low" : "good"}`}>
            {isOutOfStock ? "Out" : product.stock < 5 ? `${product.stock} left` : "In stock"}
          </span>
        </div>
      </div>

      {/* Add row */}
      {!isOutOfStock && (
        <div className="compact-add-row" onClick={e => e.stopPropagation()}>
          <div className="qty-controls">
            <button className="qty-btn" onClick={e => handleQty(e, -1)}>−</button>
            <span className="qty-value">{quantity}</span>
            <button className="qty-btn" onClick={e => handleQty(e, +1)}>+</button>
          </div>
          <button
            className={`add-cart-btn ${added ? "added" : ""} ${loading ? "loading" : ""}`}
            onClick={handleAddToCart}
            disabled={loading || added}
            title="Add to cart"
          >
            {loading ? "…" : added ? "✓" : "+"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ProductCard;