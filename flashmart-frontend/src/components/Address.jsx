import React, { useEffect, useState } from "react";
import { addressAPI } from "../api/api";

function Address({ userId, showToast }) {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  });

  const loadAddresses = async () => {
    try {
      const data = await addressAPI.getAll(userId);
      setAddresses(data.addresses || []);
    } catch {
      showToast("Failed to load addresses ❌", "error");
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleAdd = async () => {
    try {
      await addressAPI.add(userId, form);
      showToast("Address added ✅");
      setForm({
        name: "",
        phone: "",
        line1: "",
        city: "",
        state: "",
        pincode: "",
      });
      loadAddresses();
    } catch {
      showToast("Failed to add address ❌", "error");
    }
  };

  return (
    <div className="page-container">
      <h2>📍 Your Addresses</h2>

      {/* Address List */}
      {addresses.map((addr, index) => (
        <div key={index} className="card">
          <p><strong>{addr.name}</strong> ({addr.phone})</p>
          <p>{addr.line1}, {addr.city}</p>
          <p>{addr.state} - {addr.pincode}</p>
        </div>
      ))}

      {/* Add Address */}
      <h3 style={{ marginTop: "20px" }}>➕ Add New Address</h3>

      <input placeholder="Name" value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })} />

      <input placeholder="Phone" value={form.phone}
        onChange={e => setForm({ ...form, phone: e.target.value })} />

      <input placeholder="Address Line" value={form.line1}
        onChange={e => setForm({ ...form, line1: e.target.value })} />

      <input placeholder="City" value={form.city}
        onChange={e => setForm({ ...form, city: e.target.value })} />

      <input placeholder="State" value={form.state}
        onChange={e => setForm({ ...form, state: e.target.value })} />

      <input placeholder="Pincode" value={form.pincode}
        onChange={e => setForm({ ...form, pincode: e.target.value })} />

      <button onClick={handleAdd}>
        Add Address
      </button>
    </div>
  );
}

export default Address;