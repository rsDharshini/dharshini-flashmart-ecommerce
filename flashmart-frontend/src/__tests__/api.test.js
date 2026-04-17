// src/__tests__/api.test.js
import { cartAPI, orderAPI } from "../api/api";

global.fetch = jest.fn();

beforeEach(() => fetch.mockClear());

// ── cartAPI ───────────────────────────────────────────────────────────────────
test("cartAPI.getCart returns cart data", async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ cart: { items: [] } }),
  });
  const data = await cartAPI.getCart("user-123");
  expect(data.cart.items).toEqual([]);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/cart/user-123"),
    expect.any(Object)
  );
});

test("cartAPI.clearCart calls correct endpoint", async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await cartAPI.clearCart("user-123");
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/cart/clear/user-123"),
    expect.objectContaining({ method: "DELETE" })
  );
});

// ── orderAPI ──────────────────────────────────────────────────────────────────
test("orderAPI.placeOrder sends user_id", async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ message: "Order placed successfully" }),
  });
  const data = await orderAPI.placeOrder("user-123");
  expect(data.message).toBe("Order placed successfully");
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/orders/place"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ user_id: "user-123" }),
    })
  );
});

test("orderAPI.placeOrder throws on error", async () => {
  fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: "Cart is empty" }),
  });
  await expect(orderAPI.placeOrder("user-123")).rejects.toThrow("Cart is empty");
});