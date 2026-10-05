import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductList from './Pages/ProductList';
import ProductDetails from "./Pages/ProductDetails";
import Navbar from './components/Navbar';
import CartPage from './Pages/CartPage';
import CheckoutPage from './Pages/CheckoutPage';
import CheckoutReturnPage from './Pages/CheckoutReturnPage';
import PrivateRouter from './components/PrivateRouter';
import Login from './Pages/Login';
import Signup from './Pages/Signup';
import OrderHistory from './Pages/OrderHistory';
import ProfilePage from './Pages/ProfilePage';
import WishlistPage from './Pages/WishlistPage';
import AdminOrders from './Pages/AdminOrders';
import ContentPage from './Pages/ContentPage';
import ContentFooter from './components/ContentFooter';
import GuestOrderTracking from './Pages/GuestOrderTracking';
import AdminOperations from './Pages/AdminOperations';


function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/return" element={<CheckoutReturnPage />} />
        <Route path="/orders/track/:token" element={<GuestOrderTracking />} />
        <Route path="/pages/:slug" element={<ContentPage />} />
        <Route element={<PrivateRouter />}>
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/operations" element={<AdminOperations />} />
          <Route path="/admin/content/:slug/preview" element={<ContentPage preview />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
      <ContentFooter />
    </Router>
   
  );
}

export default App;