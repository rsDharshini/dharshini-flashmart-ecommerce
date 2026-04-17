// =============================================================================
// App.jsx - Main app with Admin panel (FULLY FIXED)
// =============================================================================
import React, { useState } from "react";
import Navbar        from "./components/Navbar";
import ProductList   from "./components/ProductList";
import ProductDetail from "./components/ProductDetail";
import Cart          from "./components/Cart";
import Orders        from "./components/Orders";
import Admin         from "./components/Admin";
import Toast         from "./components/Toast";
import Login         from "./components/Login";
import Register      from "./components/Register";
import Address       from "./components/Address";
import Checkout      from "./components/Checkout";   // ✅ FIXED
import { getUserFromToken } from "./utils/auth";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("login");
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const user = getUserFromToken();
  const userId = user?.userId;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setActivePage("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setSelectedProduct(null);
    setActivePage("products");
  };

  const handleSetPage = (page) => {
    setSelectedProduct(null);
    setActivePage(page);
  };

  const renderPage = () => {
    if (activePage === "detail" && selectedProduct) {
      return (
        <ProductDetail
          product={selectedProduct}
          userId={userId}
          onCartUpdate={setCartCount}
          showToast={showToast}
          onBack={handleBack}
          onProductSelect={handleProductSelect}
        />
      );
    }

    switch (activePage) {

      case "products":
        return (
          <ProductList
            userId={userId}
            onCartUpdate={setCartCount}
            showToast={showToast}
            onProductSelect={handleProductSelect}
          />
        );

      case "cart":
        return (
          <Cart
            userId={userId}
            onCartUpdate={setCartCount}
            showToast={showToast}
            onOrderPlaced={() => setActivePage("orders")}
            setActivePage={setActivePage}   // ✅ FIXED
          />
        );


      case "orders":
        return <Orders userId={userId} />;

      case "admin":
        if (user?.role !== "admin") {
          return (
            <div className="page-container">
              <h2 style={{ textAlign: "center", marginTop: "50px" }}>
                🚫 Access Denied (Admin Only)
              </h2>
            </div>
          );
        }
        return <Admin showToast={showToast} />;

      case "login":
        return (
          <Login
            setActivePage={setActivePage}
            showToast={showToast}
          />
        );

      case "register":
        return (
          <Register
            setActivePage={setActivePage}
            showToast={showToast}
          />
        );

      case "address":
        return (
          <Address
            userId={userId}
            showToast={showToast}
          />
        );
      case "checkout":
        return (
          <Checkout
            userId={userId}
            showToast={showToast}
            setActivePage={setActivePage}
            onCartUpdate={setCartCount}   // ✅ add this
          />
        );

      default:
        return null;
    }
  };

  // 🔐 SAFE AUTH CHECK
  if (!userId && activePage !== "login" && activePage !== "register") {
    return (
      <Login
        setActivePage={setActivePage}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="app">

      {/* ✅ Hide Navbar in login/register */}
      {!(activePage === "login" || activePage === "register") && (
        <Navbar
          activePage={activePage}
          setActivePage={handleSetPage}
          cartCount={cartCount}
          onProductSelect={handleProductSelect}
        />
      )}

      {(activePage === "login" || activePage === "register") ? (
        renderPage()
      ) : (
        <main className="main-content">
          {renderPage()}
        </main>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default App;