import React, { useEffect, useState } from "react";
import { cartAPI, addressAPI, orderAPI } from "../api/api";

const BASE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com";
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

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
};

const font = (size, weight = 400) => ({
  fontFamily: "'Nunito', 'Segoe UI', sans-serif",
  fontSize: size,
  fontWeight: weight,
});

const itemEmoji = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("wheat") || n.includes("flour")) return "🌾";
  if (n.includes("milk"))   return "🥛";
  if (n.includes("egg"))    return "🥚";
  if (n.includes("bread"))  return "🍞";
  if (n.includes("rice"))   return "🍚";
  if (n.includes("oil"))    return "🫙";
  if (n.includes("chip") || n.includes("snack")) return "🍟";
  if (n.includes("cola") || n.includes("drink")) return "🥤";
  if (n.includes("orange")) return "🍊";
  if (n.includes("apple"))  return "🍎";
  if (n.includes("butter")) return "🧈";
  if (n.includes("yogurt")) return "🍶";
  return "🛒";
};

/* ─── Component ─────────────────────────────────────────────────────── */
function Checkout({ userId, showToast, setActivePage, onCartUpdate }) {
  const [cart, setCart]             = useState([]);
  const [addresses, setAddresses]   = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [showPayModal, setShowPayModal]   = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [showAddrPicker, setShowAddrPicker] = useState(false);
  const [payMethod, setPayMethod]   = useState("online");
  const [promoCode, setPromoCode]   = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [cartData, addressData] = await Promise.all([
        cartAPI.getCart(userId),
        addressAPI.getAll(userId),
      ]);
      const items = Array.isArray(cartData.cart?.items) ? cartData.cart.items : [];
      setCart(items);
      setAddresses(addressData.addresses || []);
      const def = addressData.addresses?.find((a) => a.is_default);
      setSelectedAddress(def || addressData.addresses?.[0]);
    } catch {
      showToast("Failed to load checkout data ❌", "error");
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    const price = Number(String(item.price).replace(/[^0-9.]/g, ""));
    const qty   = Number(item.quantity);
    return sum + (isNaN(price) ? 0 : price) * (isNaN(qty) ? 0 : qty);
  }, 0);
  const deliveryFee = subtotal >= 500 ? 0 : subtotal > 0 ? 40 : 0;
  const taxes       = subtotal > 0 ? Math.round(subtotal * 0.05) : 0;
  const grandTotal  = subtotal + deliveryFee + taxes;

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handlePaymentSuccess = async (paymentId) => {
  try {
    await orderAPI.placeOrder(userId);
  } catch (err) { 
    console.error("Place order error:", err); 
  }
  setCart([]);
  onCartUpdate(0);
  setLoading(false);
  setShowPayModal(false);
  setShowConfirmed(true);
};

  const handleOrder = async () => {
    if (!selectedAddress) { showToast("Select an address first ⚠️", "error"); return; }
    if (subtotal <= 0)     { showToast("Your cart is empty ⚠️", "error"); return; }

    const sdkLoaded = await loadRazorpay();
    if (!sdkLoaded) { showToast("Razorpay SDK failed to load ❌", "error"); return; }

    setLoading(true);
    setShowPayModal(true);

    try {
      const orderId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const res = await fetch(`${BASE_URL}/payments/initiate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ order_id: orderId, amount: grandTotal, delivery_address: selectedAddress }),
      });
      const order = await res.json();

      if (!res.ok) {
        showToast(order.error || "Payment initiation failed ❌", "error");
        setLoading(false); setShowPayModal(false);
        return;
      }

      let handlerFired = false;

      const options = {
        key: order.razorpay_key_id,
        amount: order.amount_paise,
        currency: "INR",
        name: "Flashmart",
        description: "Order Payment",
        order_id: order.razorpay_order_id,
        handler: async (response) => {
          handlerFired = true;
          try {
            await fetch(`${BASE_URL}/payments/verify`, {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({
                razorpay_order_id:  response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_id: order.payment_id,
              }),
            });
          } catch (err) { console.error("Verify error:", err); }
          await handlePaymentSuccess(order.payment_id);
        },
        modal: {
          ondismiss: async () => {
            if (handlerFired) return;
            try {
              const statusRes  = await fetch(`${BASE_URL}/payments/status/${order.payment_id}`, { headers: authHeaders() });
              const statusData = await statusRes.json();
              if (statusData.status === "PAID") {
                await handlePaymentSuccess(order.payment_id);
              } else {
                setLoading(false); setShowPayModal(false);
                showToast("Payment cancelled", "error");
              }
            } catch {
              setLoading(false); setShowPayModal(false);
              showToast("Payment cancelled", "error");
            }
          },
        },
        theme: { color: C.green },
      };

      setShowPayModal(false);
      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", (e) => {
        showToast(e.error?.description || "Payment failed ❌", "error");
        setLoading(false);
      });
      paymentObject.open();
    } catch (e) {
      console.error("Payment flow error:", e);
      showToast("Payment failed ❌", "error");
      setLoading(false); setShowPayModal(false);
    }
  };

  const payOptions = [
    { id: "online", label: "Online Payment (Razorpay)", icon: "💳" },
    { id: "cod",    label: "Cash on delivery",          icon: "💵" },
    { id: "pos",    label: "POS on delivery",           icon: "🖥️" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalPop {
          from { transform: scale(.88) translateY(20px); opacity: 0; }
          to   { transform: scale(1)   translateY(0);    opacity: 1; }
        }
        .addr-opt:hover { border-color: ${C.green} !important; background: ${C.greenLight} !important; }
        .confirm-btn:hover:not(:disabled) { background: ${C.greenDark} !important; transform: translateY(-1px); }
        .apply-btn:hover { background: ${C.greenDark} !important; }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", padding: "28px 16px 80px", fontFamily: "'Nunito', sans-serif" }}>

        {/* Page header */}
        <div style={{ maxWidth: 1100, margin: "0 auto 24px" }}>
          <h1 style={{ ...font(26, 800), color: C.text, margin: "0 0 4px" }}>Checkout</h1>
          <p style={{ ...font(13, 500), color: C.textSec, margin: 0 }}>
            ⚡ Order now and get it within 15 mins!
          </p>
        </div>

        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}>

          {/* ══════ LEFT COLUMN ══════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Delivery Information ── */}
            <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
              <div style={{
                padding: "18px 22px 16px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ ...font(16, 700), color: C.text }}>Delivery information</span>
                <button
                  style={{
                    background: "none", border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "5px 14px",
                    ...font(13, 600), color: C.green, cursor: "pointer",
                  }}
                  onClick={() => setShowAddrPicker(!showAddrPicker)}
                >
                  ✏️ Edit
                </button>
              </div>

              <div style={{ padding: "18px 22px" }}>
                {selectedAddress ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: `linear-gradient(135deg, #e8f5ee, #d0ede0)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 26, flexShrink: 0,
                    }}>📍</div>
                    <div>
                      <div style={{ ...font(11, 700), color: C.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 3 }}>
                        Delivery to
                      </div>
                      <div style={{ ...font(15, 700), color: C.text, marginBottom: 3 }}>
                        {selectedAddress.name}
                      </div>
                      <div style={{ ...font(13, 400), color: C.textSec, lineHeight: 1.6 }}>
                        {selectedAddress.line1}, {selectedAddress.city}
                        <br />{selectedAddress.state} — {selectedAddress.pincode}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: C.textMuted, ...font(14) }}>No address found. Please add one.</p>
                )}

                {/* Address picker */}
                {showAddrPicker && addresses.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ ...font(12, 700), color: C.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                      Choose address
                    </div>
                    {addresses.map((addr) => (
                      <div
                        key={addr.address_id}
                        className="addr-opt"
                        style={{
                          border: `2px solid ${selectedAddress?.address_id === addr.address_id ? C.green : C.border}`,
                          borderRadius: 14, padding: "13px 16px",
                          marginBottom: 10, cursor: "pointer",
                          background: selectedAddress?.address_id === addr.address_id ? C.greenLight : "#fafcfa",
                          transition: "all .2s",
                        }}
                        onClick={() => { setSelectedAddress(addr); setShowAddrPicker(false); }}
                      >
                        <div style={{ ...font(14, 700), color: C.text }}>{addr.name}</div>
                        <div style={{ ...font(13, 400), color: C.textSec, marginTop: 2 }}>
                          {addr.line1}, {addr.city}, {addr.state} — {addr.pincode}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Review Items ── */}
            <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
              <div style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ ...font(16, 700), color: C.text }}>Review item by store</span>
              </div>
              <div style={{ padding: "18px 22px" }}>
                {cart.length === 0 ? (
                  <p style={{ color: C.textMuted, ...font(14), textAlign: "center", padding: "20px 0" }}>
                    Your cart is empty
                  </p>
                ) : (
                  <>
                    {/* Store header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "0 0 14px",
                      borderBottom: `1px solid ${C.border}`,
                      marginBottom: 6,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `linear-gradient(135deg, #e8f5ee, #c8e6d6)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20,
                      }}>🏪</div>
                      <div>
                        <div style={{ ...font(14, 700), color: C.text }}>Flashmart Store</div>
                        <div style={{ ...font(12, 500), color: C.textMuted }}>Delivery in 15–20 minutes</div>
                      </div>
                    </div>

                    {cart.map((item, i) => {
                      const price     = Number(String(item.price).replace(/[^0-9.]/g, ""));
                      const lineTotal = price * Number(item.quantity);
                      const isLast    = i === cart.length - 1;
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "13px 0",
                          borderBottom: isLast ? "none" : `1px solid ${C.border}`,
                        }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: 12,
                            background: `linear-gradient(135deg, #eef5ff, #dce8f8)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 24, flexShrink: 0,
                          }}>{itemEmoji(item.name)}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ ...font(14, 700), color: C.text }}>{item.name}</div>
                            <div style={{ ...font(12, 500), color: C.textMuted, marginTop: 2 }}>
                              ₹{price.toFixed(2)} each
                            </div>
                          </div>
                          <div style={{
                            display: "flex", alignItems: "center",
                            border: `1.5px solid ${C.border}`, borderRadius: 50,
                            padding: "3px 14px", ...font(14, 700), color: C.text,
                            background: "#fafcfa",
                          }}>
                            {item.quantity}
                          </div>
                          <div style={{ ...font(15, 700), color: C.text, minWidth: 70, textAlign: "right" }}>
                            ₹{lineTotal.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══════ RIGHT COLUMN ══════ */}
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
            <div style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ ...font(16, 700), color: C.text }}>Order summary</span>
            </div>

            <div style={{ padding: "20px 22px" }}>

              {/* Payment method */}
              <div style={{ marginBottom: 20 }}>
                {payOptions.map((opt) => {
                  const active = payMethod === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setPayMethod(opt.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 14px", borderRadius: 12, marginBottom: 8,
                        cursor: "pointer",
                        border: `2px solid ${active ? C.green : C.border}`,
                        background: active ? C.greenLight : "#fafcfa",
                        transition: "all .2s",
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        border: `2px solid ${active ? C.green : "#ccc"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {active && <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.green }} />}
                      </div>
                      <span style={{ ...font(14, 600), color: C.text }}>
                        {opt.icon} {opt.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Promo */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Add Promo code"
                  style={{
                    flex: 1, border: `1.5px solid ${C.border}`,
                    borderRadius: 10, padding: "10px 14px",
                    ...font(14, 500), color: C.text,
                    outline: "none", background: "#fafcfa",
                  }}
                />
                <button
                  className="apply-btn"
                  style={{
                    background: C.green, color: "#fff",
                    border: "none", borderRadius: 10,
                    padding: "10px 20px", ...font(14, 700),
                    cursor: "pointer", transition: "background .2s",
                  }}
                >Apply</button>
              </div>

              <div style={{ height: 1, background: C.border, marginBottom: 16 }} />

              {/* Price rows */}
              {[
                { label: "Subtotal", value: `₹${subtotal.toFixed(2)}` },
                { label: "Delivery fee", value: deliveryFee === 0 ? "FREE" : `₹${deliveryFee.toFixed(2)}`, green: deliveryFee === 0 },
                { label: "Taxes (5%)", value: `₹${taxes.toFixed(2)}` },
              ].map(({ label, value, green }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: 10,
                }}>
                  <span style={{ ...font(13, 500), color: C.textSec }}>{label}</span>
                  <span style={{ ...font(13, 700), color: green ? C.green : C.text }}>{value}</span>
                </div>
              ))}

              <div style={{ height: 1, background: C.border, margin: "14px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ ...font(16, 800), color: C.text }}>Total</span>
                <span style={{ ...font(20, 800), color: C.text }}>₹{grandTotal.toFixed(2)}</span>
              </div>

              {deliveryFee === 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <span style={{ background: C.greenLight, color: C.green, ...font(11, 700), padding: "3px 12px", borderRadius: 20 }}>
                    🎉 Free delivery applied
                  </span>
                </div>
              )}

              {/* Confirm button */}
              <button
                className="confirm-btn"
                style={{
                  display: "block", width: "100%",
                  marginTop: 20, padding: "15px",
                  background: loading ? "#ccc" : `linear-gradient(135deg, ${C.green}, ${C.greenMid})`,
                  color: "#fff", border: "none", borderRadius: 14,
                  ...font(16, 700), cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(26,125,79,.3)",
                  transition: "background .2s, transform .15s",
                  letterSpacing: ".3px",
                }}
                onClick={handleOrder}
                disabled={loading}
              >
                {loading ? "Processing…" : "Confirm order 💳"}
              </button>

              {/* Safety note */}
              <div style={{
                display: "flex", justifyContent: "center", gap: 16,
                marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`,
              }}>
                {[["🔒", "Secure payment"], ["⚡", "Fast delivery"], ["🌿", "Fresh quality"]].map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, ...font(11, 600), color: C.textMuted }}>
                    <span>{icon}</span>{label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ PROCESSING MODAL ══════ */}
      {showPayModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: C.white, borderRadius: 24,
            padding: "40px 36px", maxWidth: 380, width: "90%",
            textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.18)",
            animation: "modalPop .3s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              border: `5px solid ${C.border}`, borderTop: `5px solid ${C.green}`,
              margin: "0 auto 20px",
              animation: "spin 1s linear infinite",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
            }}>🔒</div>
            <div style={{ ...font(20, 800), color: C.text, marginBottom: 8 }}>Securely processing…</div>
            <div style={{ ...font(13, 500), color: C.textSec }}>Please wait while we initiate your payment</div>
          </div>
        </div>
      )}

      {/* ══════ ORDER CONFIRMED MODAL ══════ */}
      {showConfirmed && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: C.white, borderRadius: 24,
            padding: "40px 36px", maxWidth: 400, width: "90%",
            textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.18)",
            animation: "modalPop .3s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉🎊✨</div>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.green}, ${C.greenMid})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40, margin: "0 auto 20px",
              boxShadow: "0 8px 24px rgba(26,125,79,.3)",
            }}>✅</div>
            <div style={{ ...font(24, 800), color: C.text, marginBottom: 10 }}>Order Confirmed!</div>
            <div style={{ ...font(14, 500), color: C.textSec, marginBottom: 28, lineHeight: 1.7 }}>
              Your order has been placed successfully.<br />
              You'll receive a confirmation shortly.
            </div>
            <button
              style={{
                display: "block", width: "100%",
                padding: "14px", marginBottom: 10,
                background: `linear-gradient(135deg, ${C.green}, ${C.greenMid})`,
                color: "#fff", border: "none", borderRadius: 14,
                ...font(15, 700), cursor: "pointer",
                boxShadow: "0 4px 14px rgba(26,125,79,.3)",
              }}
              onClick={() => { setShowConfirmed(false); setActivePage("orders"); }}
            >
              View order details
            </button>
            <button
              style={{
                display: "block", width: "100%",
                padding: "14px", background: "none",
                color: C.green, border: `2px solid ${C.green}`,
                borderRadius: 14, ...font(15, 700), cursor: "pointer",
              }}
              onClick={() => { setShowConfirmed(false); setActivePage("products"); }}
            >
              Continue shopping
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Checkout;