import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductList from './Pages/ProductList';
import ProductDetails from "./Pages/ProductDetails";
import Navbar from './components/Navbar';
import CartPage from './Pages/CartPage';
import CheckoutPage from './Pages/CheckoutPage';
import PrivateRouter from './components/PrivateRouter';
import Login from './Pages/Login';
import Signup from './Pages/Signup';
import OrderHistory from './Pages/OrderHistory';
import ProfilePage from './Pages/ProfilePage';


function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<CartPage />} />
        <Route element={<PrivateRouter />}>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </Router>
   
  );
}

export default App;