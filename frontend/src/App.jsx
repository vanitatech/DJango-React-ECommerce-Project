import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import ProductList from './Pages/ProductList';
import ProductDetails from "./Pages/ProductDetails";
import Navbar from './components/Navbar';
import CartPage from './Pages/CartPage';
import CheckoutPage from './Pages/CheckoutPage';

function App() {
  return (
    <Router>
        <Navbar/>
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<CartPage/>}/>
          <Route path="/checkout" element={<CheckoutPage/>}/>
        </Routes>
    </Router>
  );
}

export default App;