// =============================================================================
// api.js - All API calls with CloudWatch-style logging
// =============================================================================
import logger from "../utils/logger";

const BASE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com/v1";

// ── Auth Helpers ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("token");

const authHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// ── Response Handler with logging ─────────────────────────────────────────────
const handleResponse = async (res, context = "") => {
  let data = {};
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    logger.apiErr(`${context} failed`, { status: res.status, error: data?.error || data?.message, url: res.url });
    throw new Error(data?.error || data?.message || "Request failed");
  }

  return data;
};

// ── Timed fetch with logging ───────────────────────────────────────────────────
const apiFetch = async (context, url, options = {}) => {
  const start = Date.now();
  logger.api(`${context} → ${options.method || "GET"} ${url.replace(BASE_URL, "")}`);
  try {
    const res = await fetch(url, options);
    const data = await handleResponse(res, context);
    logger.api(`${context} ✓`, { duration: `${Date.now() - start}ms`, status: res.status });
    return data;
  } catch (err) {
    logger.apiErr(`${context} ✗`, { duration: `${Date.now() - start}ms`, error: err.message });
    throw err;
  }
};

// ── Product Service ───────────────────────────────────────────────────────────
export const productAPI = {
  getAll: () =>
    apiFetch("productAPI.getAll", `${BASE_URL}/products`),

  getById: (id) =>
    apiFetch("productAPI.getById", `${BASE_URL}/products/${id}`),

  create: (data) => {
    logger.product("Admin creating product", { name: data.name, category: data.category });
    return apiFetch("productAPI.create", `${BASE_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  update: (id, data) => {
    logger.product("Admin updating product", { id, fields: Object.keys(data) });
    return apiFetch("productAPI.update", `${BASE_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  uploadImage: (id, base64DataUrl) => {
    const parts = base64DataUrl.split(",");
    const contentType = parts[0].split(":")[1].split(";")[0];
    logger.product("Admin uploading image", { id, contentType });
    return apiFetch("productAPI.uploadImage", `${BASE_URL}/products/${id}/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: parts[1], image_content_type: contentType }),
    });
  },
};

// ── Cart Service ──────────────────────────────────────────────────────────────
export const cartAPI = {
  getCart: (userId) =>
    apiFetch("cartAPI.getCart", `${BASE_URL}/cart/${userId}`, { headers: authHeaders() }),

  addItem: (userId, productId, quantity) => {
    logger.cart("Item added to cart", { userId, productId, quantity });
    return apiFetch("cartAPI.addItem", `${BASE_URL}/cart/add`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId, product_id: productId, quantity }),
    });
  },

  updateQuantity: (userId, productId, quantity) => {
    logger.cart("Cart quantity updated", { userId, productId, quantity });
    return apiFetch("cartAPI.updateQuantity", `${BASE_URL}/cart/update`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId, product_id: productId, quantity }),
    });
  },

  removeItem: (userId, productId) => {
    logger.cart("Item removed from cart", { userId, productId });
    return apiFetch("cartAPI.removeItem", `${BASE_URL}/cart/remove`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId, product_id: productId }),
    });
  },

  clearCart: (userId) => {
    logger.cart("Cart cleared", { userId });
    return apiFetch("cartAPI.clearCart", `${BASE_URL}/cart/clear/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  },
};

// ── Order Service ─────────────────────────────────────────────────────────────
export const orderAPI = {
  placeOrder: (userId) => {
    logger.order("Order placement initiated", { userId });
    return apiFetch("orderAPI.placeOrder", `${BASE_URL}/orders/place`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
  },

  getOrders: (userId) =>
    apiFetch("orderAPI.getOrders", `${BASE_URL}/orders/${userId}`, { headers: authHeaders() }),

  cancelOrder: (orderId) => {
    logger.order("Order cancellation requested", { orderId });
    return apiFetch("orderAPI.cancelOrder", `${BASE_URL}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
  },

  updateStatus: (orderId, status) => {
    logger.order("Admin updating order status", { orderId, status });
    return apiFetch("orderAPI.updateStatus", `${BASE_URL}/orders/${orderId}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
  },
};

// ── Auth Service ──────────────────────────────────────────────────────────────
export const authAPI = {
  register: (email, password, role = "user") => {
    logger.auth("User registration attempt", { email, role });
    return apiFetch("authAPI.register", `${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
  },

  login: (email, password) => {
    logger.auth("Login attempt", { email });
    return apiFetch("authAPI.login", `${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  },
};

// ── Address Service ───────────────────────────────────────────────────────────
export const addressAPI = {
  getAll: (userId) => {
    if (!getToken()) throw new Error("No token found");
    return apiFetch("addressAPI.getAll", `${BASE_URL}/addresses/${userId}`, { headers: authHeaders() });
  },

  add: (userId, data) => {
    if (!getToken()) throw new Error("No token found");
    logger.info("ADDRESS", "New address added", { userId });
    return apiFetch("addressAPI.add", `${BASE_URL}/addresses/${userId}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
  },
};

// ── Payment Service ───────────────────────────────────────────────────────────
export const paymentAPI = {
  initiate: (orderId, amount, deliveryAddress) => {
    logger.payment("Payment initiated", { orderId, amount });
    return apiFetch("paymentAPI.initiate", `${BASE_URL}/payments/initiate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ order_id: orderId, amount, delivery_address: deliveryAddress }),
    });
  },

  verify: (paymentData) => {
    logger.payment("Payment verification", { orderId: paymentData.order_id });
    return apiFetch("paymentAPI.verify", `${BASE_URL}/payments/verify`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(paymentData),
    });
  },

  getStatus: (paymentId) =>
    apiFetch("paymentAPI.getStatus", `${BASE_URL}/payments/status/${paymentId}`, { headers: authHeaders() }),
};