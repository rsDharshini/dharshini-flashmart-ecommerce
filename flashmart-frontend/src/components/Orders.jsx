// =============================================================================
// Orders.jsx - Order history page (fixed)
// =============================================================================
import React, { useState, useEffect } from "react";
import { orderAPI } from "../api/api";

const STATUS_COLORS = {
  PLACED:    { bg: "#fff3e0", color: "#e65100" },
  CONFIRMED: { bg: "#e3f2fd", color: "#1565c0" },
  SHIPPED:   { bg: "#f3e5f5", color: "#6a1b9a" },
  DELIVERED: { bg: "#e8f5e9", color: "#2e7d32" },
  CANCELLED: { bg: "#ffebee", color: "#c62828" },
};

function Orders({ userId }) {
  if (!userId) return null;
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [updating, setUpdating] = useState(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data   = await orderAPI.getOrders(userId);
      const sorted = (data.orders || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setOrders(sorted);
    } catch {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel order — uses dedicated endpoint that restocks products ──────────
  const handleCancel = async (orderId) => {
    setUpdating(orderId);
    try {
      await orderAPI.cancelOrder(orderId);
      await fetchOrders();
    } catch {
      alert("Failed to cancel order");
    } finally {
      setUpdating(null);
    }
  };

  // ── Status update — confirm / ship / deliver ───────────────────────────────
  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await orderAPI.updateStatus(orderId, newStatus);
      await fetchOrders();
    } catch {
      alert("Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  if (loading) return <div className="center-state"><div className="spinner" /><p>Loading orders...</p></div>;
  if (error)   return <div className="error-state"><span>⚠️ {error}</span><button className="retry-btn" onClick={fetchOrders}>Retry</button></div>;

  if (orders.length === 0) {
    return (
      <div className="page-container fade-in">
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>No orders yet</h2>
          <p>Place your first order from the cart!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Orders</h1>
          <p className="page-subtitle">{orders.length} orders placed</p>
        </div>
      </div>

      <div className="orders-list">
        {orders.map((order) => {
          const statusStyle = STATUS_COLORS[order.status] || STATUS_COLORS.PLACED;
          return (
            <div key={order.order_id} className="order-card">

              {/* Order Header */}
              <div className="order-header">
                <div>
                  <p className="order-id">Order #{order.order_id.slice(0, 8).toUpperCase()}</p>
                  <p className="order-date">{formatDate(order.created_at)}</p>
                </div>
                <div className="order-header-right">
                  <span className="status-badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {order.status}
                  </span>
                  <span className="order-total">₹{order.total_amount}</span>
                </div>
              </div>

              {/* Order Items */}
              <div className="order-items">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="order-item-row">
                    <span className="order-item-name">{item.name}</span>
                    <span className="order-item-qty">× {item.quantity}</span>
                    <span className="order-item-price">₹{item.total_price}</span>
                  </div>
                ))}
              </div>

              {/* Status Progress — hidden for cancelled orders */}
              {order.status !== "CANCELLED" && (
                <div className="status-progress">
                  {["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"].map((s, i) => {
                    const steps    = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"];
                    const curIndex = steps.indexOf(order.status);
                    const isDone   = i <= curIndex;
                    return (
                      <React.Fragment key={s}>
                        <div className={`progress-step ${isDone ? "done" : ""}`}>
                          <div className="step-dot" />
                          <span className="step-label">{s}</span>
                        </div>
                        {i < 3 && <div className={`progress-line ${i < curIndex ? "done" : ""}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              {order.status === "PLACED" && (
                <div className="order-actions">
                  <button
                    className="status-btn confirm"
                    onClick={() => handleStatusUpdate(order.order_id, "CONFIRMED")}
                    disabled={updating === order.order_id}
                  >
                    {updating === order.order_id ? "..." : "Confirm Order"}
                  </button>
                  <button
                    className="status-btn cancel"
                    onClick={() => handleCancel(order.order_id)}
                    disabled={updating === order.order_id}
                  >
                    {updating === order.order_id ? "..." : "Cancel"}
                  </button>
                </div>
              )}

              {order.status === "CONFIRMED" && (
                <div className="order-actions">
                  <button
                    className="status-btn confirm"
                    onClick={() => handleStatusUpdate(order.order_id, "SHIPPED")}
                    disabled={updating === order.order_id}
                  >
                    {updating === order.order_id ? "..." : "Mark Shipped"}
                  </button>
                  <button
                    className="status-btn cancel"
                    onClick={() => handleCancel(order.order_id)}
                    disabled={updating === order.order_id}
                  >
                    {updating === order.order_id ? "..." : "Cancel"}
                  </button>
                </div>
              )}

              {order.status === "SHIPPED" && (
                <div className="order-actions">
                  <button
                    className="status-btn confirm"
                    onClick={() => handleStatusUpdate(order.order_id, "DELIVERED")}
                    disabled={updating === order.order_id}
                  >
                    {updating === order.order_id ? "..." : "Mark Delivered"}
                  </button>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Orders;