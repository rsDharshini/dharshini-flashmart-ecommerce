// =============================================================================
// App.jsx - Updated with Home page
// =============================================================================
import React, { useState } from "react";
import UserNavbar    from "./components/UserNavbar";
import AdminNavbar   from "./components/AdminNavbar";
import Home          from "./components/Home";          // ✅ NEW
import ProductList   from "./components/ProductList";
import ProductDetail from "./components/ProductDetail";
import Cart          from "./components/Cart";
import Orders        from "./components/Orders";
import Admin         from "./components/Admin";
import Toast         from "./components/Toast";
import Login         from "./components/Login";
import Register      from "./components/Register";
import Address       from "./components/Address";
import Checkout      from "./components/Checkout";
import Profile from "./components/Profile";
import { getUserFromToken } from "./utils/auth";
import "./App.css";

function App() {
  const [activePage,      setActivePage]      = useState("login");
  const [cartCount,       setCartCount]       = useState(0);
  const [toast,           setToast]           = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [role,            setRole]            = useState(localStorage.getItem("role"));
  const [activeCategory,  setActiveCategory]  = useState("All"); // ✅ NEW — shared between Home & ProductList

  const user   = getUserFromToken();
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

      // ✅ NEW — Home page (after login, default landing)
      case "home":
        return (
          <Home
            userId={userId}
            onCartUpdate={setCartCount}
            showToast={showToast}
            onProductSelect={handleProductSelect}
            setActivePage={handleSetPage}
            setActiveCategory={setActiveCategory}   // passed so "See All" can pre-filter
          />
        );

      case "products":
        return (
          <ProductList
            userId={userId}
            onCartUpdate={setCartCount}
            showToast={showToast}
            onProductSelect={handleProductSelect}
            activeCategory={activeCategory}         // ✅ pre-select category from Home
            setActiveCategory={setActiveCategory}
          />
        );

      case "cart":
        return <Cart userId={userId} onCartUpdate={setCartCount} showToast={showToast} onOrderPlaced={() => setActivePage("orders")} setActivePage={setActivePage} />;
      case "orders":
        return <Orders userId={userId} />;
      case "admin":
        if (role !== "admin") return <div className="page-container"><h2 style={{ textAlign: "center", marginTop: 50 }}>🚫 Access Denied</h2></div>;
        return <Admin showToast={showToast} />;

      // ✅ after login → go to "home" now
      case "login":
        return <Login setActivePage={setActivePage} showToast={showToast} setRole={setRole} />;
      case "register":
        return <Register setActivePage={setActivePage} showToast={showToast} />;
      case "address":
        return <Address userId={userId} showToast={showToast} />;
      case "checkout":
        return <Checkout userId={userId} showToast={showToast} setActivePage={setActivePage} onCartUpdate={setCartCount} />;
      case "profile":
        return <Profile userId={userId} showToast={showToast} setActivePage={handleSetPage} />;
      default:
        return null;
    }
  };

  if (!userId && activePage !== "login" && activePage !== "register") {
    return <Login setActivePage={setActivePage} showToast={showToast} setRole={setRole} />;
  }

  const isAuthPage = activePage === "login" || activePage === "register";

  return (
    <div className="app">
      {!isAuthPage && (
        role === "admin"
          ? <AdminNavbar activePage={activePage} setActivePage={handleSetPage} />
          : <UserNavbar activePage={activePage} setActivePage={handleSetPage} cartCount={cartCount} onProductSelect={handleProductSelect} />
      )}
      {isAuthPage ? renderPage() : <main className="main-content">{renderPage()}</main>}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default App;