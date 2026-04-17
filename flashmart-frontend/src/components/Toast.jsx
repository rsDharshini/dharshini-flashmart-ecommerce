// =============================================================================
// Toast.js - Notification popup
// =============================================================================
import React from "react";

function Toast({ message, type }) {
  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">
        {type === "error" ? "❌" : "✅"}
      </span>
      <span>{message}</span>
    </div>
  );
}

export default Toast;