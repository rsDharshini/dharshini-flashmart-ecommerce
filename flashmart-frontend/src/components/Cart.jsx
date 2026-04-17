import React, { useState, useEffect } from "react";
import { cartAPI } from "../api/api";

/* ─── Google Fonts ──────────────────────────────────────────────────── */
const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');`;
console.log("NEW CART UI LOADED 🚀");
/* ─── Design Tokens ─────────────────────────────────────────────────── */
const C = {
  bg:        "#f4f6f4",
  white:     "#ffffff",
  green:     "#1a7d4f",
  greenDark: "#155f3c",
  greenLight:"#e8f5ee",
  greenMid:  "#25a868",
  red:       "#e53935",
  redLight:  "#fdecea",
  border:    "#e8ede9",
  text:      "#1a1a2e",
  textSec:   "#5a6472",
  textMuted: "#9ba8a0",
  shadow:    "0 2px 12px rgba(0,0,0,.06)",
  shadowMd:  "0 4px 24px rgba(0,0,0,.09)",
};

const font = (size, weight = 400) => ({
  fontFamily: "'Nunito', 'Segoe UI', sans-serif",
  fontSize: size,
  fontWeight: weight,
});

/* ─── emoji helper ──────────────────────────────────────────────────── */
const itemEmoji = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("wheat") || n.includes("flour")) return "🌾";
  if (n.includes("milk"))   return "🥛";
  if (n.includes("egg"))    return "🥚";
  if (n.includes("bread"))  return "🍞";
  if (n.includes("rice"))   return "🍚";
  if (n.includes("oil"))    return "🫙";
  if (n.includes("tomato")) return "🍅";
  if (n.includes("onion"))  return "🧅";
  if (n.includes("potato")) return "🥔";
  if (n.includes("apple"))  return "🍎";
  if (n.includes("banana")) return "🍌";
  if (n.includes("carrot")) return "🥕";
  if (n.includes("cheese")) return "🧀";
  if (n.includes("butter")) return "🧈";
  if (n.includes("chip") || n.includes("snack")) return "🍟";
  if (n.includes("cola") || n.includes("drink") || n.includes("bev")) return "🥤";
  if (n.includes("chicken") || n.includes("meat")) return "🍗";
  if (n.includes("fish"))   return "🐟";
  if (n.includes("yogurt") || n.includes("curd")) return "🍶";
  if (n.includes("orange")) return "🍊";
  return "🛒";
};

/* ─── Component ─────────────────────────────────────────────────────── */
function Cart({ userId, onCartUpdate, showToast, setActivePage }) {
  if (!userId) return null;

  const [cart, setCart]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { fetchCart(); }, []);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const data = await cartAPI.getCart(userId);
      setCart(data.cart || null);
      const count = (data.cart?.items || []).reduce((s, i) => s + i.quantity, 0);
      onCartUpdate(count);
    } catch {
      setError("Failed to load cart");
    } finally { setLoading(false); }
  };

  const handleQtyChange = async (productId, newQty) => {
    try {
      const data = await cartAPI.updateQuantity(userId, productId, newQty);
      setCart(data.cart);
      onCartUpdate((data.cart?.items || []).reduce((s, i) => s + i.quantity, 0));
    } catch { showToast("Failed to update quantity", "error"); }
  };

  const handleRemove = async (productId, name) => {
    try {
      const data = await cartAPI.removeItem(userId, productId);
      setCart(data.cart);
      onCartUpdate((data.cart?.items || []).reduce((s, i) => s + i.quantity, 0));
      showToast(`${name} removed`);
    } catch { showToast("Failed to remove item", "error"); }
  };

  const handleClearCart = async () => {
    try {
      await cartAPI.clearCart(userId);
      setCart(null);
      onCartUpdate(0);
      showToast("Cart cleared");
    } catch { showToast("Failed to clear cart", "error"); }
  };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <style>{FONT_LINK}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
        <p style={{ ...font(14, 500), color: C.textSec }}>Loading your cart…</p>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <style>{FONT_LINK}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: C.red, ...font(14, 500) }}>{error}</p>
        <button onClick={fetchCart} style={{
          marginTop: 14, padding: "9px 24px", borderRadius: 50,
          border: `1.5px solid ${C.border}`, cursor: "pointer",
          ...font(13, 600), background: C.white, color: C.green,
        }}>Try again</button>
      </div>
    </div>
  );

  /* ── Derived values ── */
  const items = cart?.items || [];
  const subtotal = items.reduce((sum, item) => {
    const price = Number(String(item.price).replace(/[^0-9.]/g, ""));
    const qty   = Number(item.quantity);
    return sum + (isNaN(price) ? 0 : price) * (isNaN(qty) ? 0 : qty);
  }, 0);
  const freeDeliveryThreshold = 500;
  const deliveryFee   = subtotal >= freeDeliveryThreshold ? 0 : 40;
  const taxes         = subtotal > 0 ? Math.round(subtotal * 0.05) : 0;
  const grandTotal    = subtotal + deliveryFee + taxes;
  const remainingForFree = freeDeliveryThreshold - subtotal;
  const freeDeliveryProgress = Math.min((subtotal / freeDeliveryThreshold) * 100, 100);

  /* ── Empty ── */
  if (items.length === 0) return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <style>{FONT_LINK}</style>
      <div style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🧺</div>
        <div style={{ ...font(24, 800), color: C.text, marginBottom: 8 }}>Your cart is empty</div>
        <p style={{ ...font(14, 400), color: C.textSec, marginBottom: 28 }}>
          Browse fresh produce and daily essentials to get started.
        </p>
        <button
          style={{
            padding: "13px 36px", background: C.green, color: "#fff",
            border: "none", borderRadius: 50, ...font(15, 700),
            cursor: "pointer", boxShadow: `0 4px 14px rgba(26,125,79,.3)`,
          }}
          onClick={() => setActivePage("products")}
        >
          Shop now →
        </button>
      </div>
    </div>
  );

  /* ── Main Render ── */
  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "28px 16px 80px", fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        ${FONT_LINK}
        .cart-item-row:hover { background: #f9fdfb !important; }
        .step-btn:hover { background: ${C.greenLight} !important; }
        .remove-btn:hover { color: ${C.red} !important; background: ${C.redLight} !important; }
        .checkout-btn:hover { background: ${C.greenDark} !important; transform: translateY(-1px); }
        .clear-btn:hover { background: ${C.redLight} !important; }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ ...font(26, 800), color: C.text, margin: "0 0 4px" }}>
            🛒 My Cart
          </h1>
          <p style={{ ...font(13, 500), color: C.textSec, margin: 0 }}>
            {items.length} item{items.length !== 1 ? "s" : ""} in your cart
          </p>
        </div>

        {/* ── Free Delivery Progress ── */}
        <div style={{
          background: C.white, borderRadius: 16, padding: "16px 20px",
          marginBottom: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...font(13, 600), color: C.text }}>
              {remainingForFree > 0
                ? <>🚚 Add <span style={{ color: C.green }}>₹{remainingForFree.toFixed(0)}</span> more for FREE delivery</>
                : <><span style={{ color: C.green }}>✅ Yay! You've unlocked FREE delivery</span></>
              }
            </span>
            <span style={{ ...font(12, 600), color: C.textMuted }}>
              ₹{subtotal.toFixed(0)} / ₹{freeDeliveryThreshold}
            </span>
          </div>
          <div style={{ height: 7, background: C.border, borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg, ${C.greenMid}, ${C.green})`,
              width: `${freeDeliveryProgress}%`,
              transition: "width .4s ease",
            }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

          {/* ── Cart Items Card ── */}
          <div style={{
            background: C.white, borderRadius: 20, border: `1px solid ${C.border}`,
            boxShadow: C.shadow, overflow: "hidden",
          }}>
            <div style={{
              padding: "18px 22px 14px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ ...font(15, 700), color: C.text }}>Cart Items</span>
              <span style={{
                background: C.greenLight, color: C.green,
                ...font(12, 700), padding: "3px 12px", borderRadius: 20,
              }}>{items.length} items</span>
            </div>

            {items.map((item, idx) => {
              const price     = Number(String(item.price).replace(/[^0-9.]/g, ""));
              const lineTotal = price * Number(item.quantity);
              const isLast    = idx === items.length - 1;

              return (
                <div
                  key={item.product_id}
                  className="cart-item-row"
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 22px",
                    borderBottom: isLast ? "none" : `1px solid ${C.border}`,
                    transition: "background .15s",
                  }}
                >
                  {/* Emoji badge */}
                  <div style={{
                    width: 54, height: 54, borderRadius: 14,
                    background: `linear-gradient(135deg, #e8f5ee, #d0ede0)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, flexShrink: 0, border: `1.5px solid ${C.border}`,
                  }}>
                    {itemEmoji(item.name)}
                  </div>

                  {/* Name & price */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...font(14, 700), color: C.text, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.name}
                    </div>
                    <div style={{ ...font(12, 500), color: C.textMuted }}>
                      ₹{price.toFixed(2)} / unit
                    </div>
                  </div>

                  {/* Qty stepper */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    border: `1.5px solid ${C.border}`, borderRadius: 50,
                    overflow: "hidden", background: C.white,
                  }}>
                    <button
                      className="step-btn"
                      style={{
                        background: "none", border: "none",
                        width: 34, height: 34, cursor: "pointer",
                        color: C.green, ...font(18, 700),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background .12s", borderRadius: "50% 0 0 50%",
                      }}
                      onClick={() => handleQtyChange(item.product_id, item.quantity - 1)}
                    >−</button>
                    <span style={{ ...font(14, 700), color: C.text, minWidth: 28, textAlign: "center" }}>
                      {item.quantity}
                    </span>
                    <button
                      className="step-btn"
                      style={{
                        background: "none", border: "none",
                        width: 34, height: 34, cursor: "pointer",
                        color: C.green, ...font(18, 700),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background .12s", borderRadius: "0 50% 50% 0",
                      }}
                      onClick={() => handleQtyChange(item.product_id, item.quantity + 1)}
                    >+</button>
                  </div>

                  {/* Line total */}
                  <div style={{ ...font(15, 700), color: C.text, minWidth: 70, textAlign: "right" }}>
                    ₹{lineTotal.toFixed(0)}
                  </div>

                  {/* Remove btn */}
                  <button
                    className="remove-btn"
                    style={{
                      background: "none", border: "none",
                      color: C.textMuted, cursor: "pointer",
                      width: 32, height: 32, borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      ...font(14), transition: "color .15s, background .15s",
                      flexShrink: 0,
                    }}
                    onClick={() => handleRemove(item.product_id, item.name)}
                    title="Remove"
                  >✕</button>
                </div>
              );
            })}
          </div>

          {/* ── Order Summary Card ── */}
          <div style={{
            background: C.white, borderRadius: 20,
            border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden",
          }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ ...font(15, 700), color: C.text }}>Order Summary</span>
            </div>

            <div style={{ padding: "20px 22px" }}>
              {/* Price rows */}
              {[
                { label: `Subtotal (${items.length} item${items.length !== 1 ? "s" : ""})`, value: `₹${subtotal.toFixed(2)}`, highlight: false },
                { label: "Delivery fee", value: deliveryFee === 0 ? "FREE" : `₹${deliveryFee.toFixed(2)}`, highlight: deliveryFee === 0 },
                { label: "Taxes & charges (5%)", value: `₹${taxes.toFixed(2)}`, highlight: false },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 12,
                }}>
                  <span style={{ ...font(13, 500), color: C.textSec }}>{label}</span>
                  <span style={{
                    ...font(13, 700),
                    color: highlight ? C.green : C.text,
                  }}>{value}</span>
                </div>
              ))}

              <div style={{ height: 1, background: C.border, margin: "16px 0" }} />

              {/* Grand total */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ ...font(16, 800), color: C.text }}>Total payable</span>
                <span style={{ ...font(20, 800), color: C.text }}>₹{grandTotal.toFixed(2)}</span>
              </div>

              {deliveryFee === 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <span style={{
                    background: C.greenLight, color: C.green,
                    ...font(11, 700), padding: "3px 12px", borderRadius: 20,
                  }}>🎉 You save ₹40 on delivery!</span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                className="checkout-btn"
                style={{
                  display: "block", width: "100%",
                  marginTop: 20, padding: "15px",
                  background: `linear-gradient(135deg, ${C.green}, ${C.greenMid})`,
                  color: "#fff", border: "none", borderRadius: 14,
                  ...font(15, 700), cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(26,125,79,.3)",
                  transition: "background .2s, transform .15s",
                  letterSpacing: ".3px",
                }}
                onClick={() => setActivePage("checkout")}
              >
                Proceed to Checkout →
              </button>

              {/* Clear basket */}
              <button
                className="clear-btn"
                style={{
                  display: "block", width: "100%",
                  marginTop: 10, padding: "13px",
                  background: "none", color: C.red,
                  border: `1.5px solid #f4c3bf`,
                  borderRadius: 14, ...font(13, 600),
                  cursor: "pointer", transition: "background .15s",
                }}
                onClick={handleClearCart}
              >
                Clear cart
              </button>

              {/* Trust badges */}
              <div style={{
                display: "flex", justifyContent: "center", gap: 20,
                marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.border}`,
              }}>
                {[["🔒", "Secure"], ["🌿", "Fresh"], ["⚡", "Fast delivery"]].map(([icon, label]) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    ...font(11, 600), color: C.textMuted,
                  }}>
                    <span>{icon}</span>{label}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Cart;