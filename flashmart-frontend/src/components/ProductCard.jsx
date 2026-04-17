// =============================================================================
// ProductCard.jsx - Gromuse-style card
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
    <div className={`product-card ${isOutOfStock ? "out-of-stock" : ""}`} onClick={() => onClick && onClick(product)}>
      <div className="product-image-wrapper">
        <img
          src={product.image_url || `https://via.placeholder.com/200x200/f0f7f0/2d6a4f?text=${encodeURIComponent(product.name)}`}
          alt={product.name}
          className="product-image"
          onError={e => { e.target.src = `https://via.placeholder.com/200x200/f0f7f0/2d6a4f?text=${encodeURIComponent(product.name[0])}`; }}
        />
        {isOutOfStock && <div className="out-of-stock-overlay">Out of Stock</div>}
        {product.discount_percentage > 0 && (
          <div className="discount-badge">-{product.discount_percentage}%</div>
        )}
      </div>

      <div className="product-info">
        <div className="product-category">{product.category}</div>
        <h3 className="product-name">{product.name}</h3>
        <p className="product-brand">{product.brand}</p>
        <p className="product-weight">500 gm.</p>

        <div className="product-pricing">
          {product.discount_percentage > 0 && (
            <span className="original-price">₹{product.price}</span>
          )}
          <span className="final-price">₹{product.final_price || product.price}</span>
        </div>

        <div className="stock-info">
          <span className={`stock-dot ${product.stock < 5 ? "low" : "good"}`} />
          <span className="stock-text">
            {isOutOfStock ? "Out of stock" : product.stock < 5 ? `Only ${product.stock} left` : "In stock"}
          </span>
        </div>
      </div>

      {!isOutOfStock && (
        <div className="product-add-row" onClick={e => e.stopPropagation()}>
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