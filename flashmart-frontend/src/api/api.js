// =============================================================================
// api.js - All API calls (FULLY FIXED)
// =============================================================================

const BASE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com";

// ── Auth Helpers ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("token");

const authHeaders = () => {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// ── Response Handler ──────────────────────────────────────────────────────────
const handleResponse = async (res) => {
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    console.error("API ERROR:", res.status, data);
    throw new Error(data?.error || data?.message || "Request failed");
  }

  return data;
};

// ── Product Service ───────────────────────────────────────────────────────────
export const productAPI = {
  getAll: () =>
    fetch(`${BASE_URL}/products`)
      .then(handleResponse),

  getById: (id) =>
    fetch(`${BASE_URL}/products/${id}`)
      .then(handleResponse),

  create: (data) =>
    fetch(`${BASE_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id, data) =>
    fetch(`${BASE_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  uploadImage: (id, base64DataUrl) => {
    const parts = base64DataUrl.split(",");
    const contentType = parts[0].split(":")[1].split(";")[0];
    const imageData = parts[1];

    return fetch(`${BASE_URL}/products/${id}/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        image_content_type: contentType
      }),
    }).then(handleResponse);
  },
};

// ── Cart Service ──────────────────────────────────────────────────────────────
export const cartAPI = {
  getCart: (userId) =>
    fetch(`${BASE_URL}/cart/${userId}`, {
      headers: authHeaders(),
    }).then(handleResponse),

  addItem: (userId, productId, quantity) =>
    fetch(`${BASE_URL}/cart/add`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
        quantity
      }),
    }).then(handleResponse),

  updateQuantity: (userId, productId, quantity) =>
    fetch(`${BASE_URL}/cart/update`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
        quantity
      }),
    }).then(handleResponse),

  removeItem: (userId, productId) =>
    fetch(`${BASE_URL}/cart/remove`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({
        user_id: userId,
        product_id: productId
      }),
    }).then(handleResponse),

  clearCart: (userId) =>
    fetch(`${BASE_URL}/cart/clear/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(handleResponse),
};

// ── Order Service ─────────────────────────────────────────────────────────────
export const orderAPI = {
  placeOrder: (userId) =>
    fetch(`${BASE_URL}/orders/place`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId }),
    }).then(handleResponse),

  getOrders: (userId) =>
    fetch(`${BASE_URL}/orders/${userId}`, {
      headers: authHeaders(),
    }).then(handleResponse),

  cancelOrder: (orderId) =>
    fetch(`${BASE_URL}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handleResponse),

  updateStatus: (orderId, status) =>
    fetch(`${BASE_URL}/orders/${orderId}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    }).then(handleResponse),
};

// ── Auth Service ──────────────────────────────────────────────────────────────
export const authAPI = {
  register: (email, password, role = "user") =>
    fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    }).then(handleResponse),

  login: (email, password) =>
    fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(handleResponse),
};

// ── Address Service (FIXED) ───────────────────────────────────────────────────
export const addressAPI = {
  getAll: async (userId) => {
    const token = getToken();
    if (!token) throw new Error("No token found");

    const res = await fetch(`${BASE_URL}/addresses/${userId}`, {
      method: "GET",
      headers: authHeaders(),
    });

    return handleResponse(res);
  },

  add: async (userId, data) => {
    const token = getToken();
    if (!token) throw new Error("No token found");

    const res = await fetch(`${BASE_URL}/addresses/${userId}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    return handleResponse(res);
  },
};

// ── Payment Service ───────────────────────────────────────────────────────────
export const paymentAPI = {
  initiate: (orderId, amount, deliveryAddress) =>
    fetch(`${BASE_URL}/payments/initiate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        amount: amount,
        delivery_address: deliveryAddress
      }),
    }).then(handleResponse),

  verify: (paymentData) =>
    fetch(`${BASE_URL}/payments/verify`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(paymentData),
    }).then(handleResponse),

  getStatus: (paymentId) =>
    fetch(`${BASE_URL}/payments/status/${paymentId}`, {
      headers: authHeaders(),
    }).then(handleResponse),
};