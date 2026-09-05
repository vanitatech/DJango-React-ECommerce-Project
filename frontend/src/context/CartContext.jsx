import {createContext, useContext, useState, useEffect} from 'react';
import { authFetch, getAccessToken} from '../utils/auth';
const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [cartItems, setCartItems] = useState([]);
    const [total, setTotal] = useState(0);

    //Fetch cart form backend
    const fetchCart = async () => {
        try {
            const response = await authFetch(`${BASEURL}/api/cart/`);
            const data = await response.json();
            setCartItems(data.items || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Error fetching cart:', error);
        }
    };

    useEffect(() => {
        fetchCart();
    }, []); 

    //Add Product to Cart
    const addToCart = async (productId) => {
        try {
            await authFetch(`${BASEURL}/api/cart/add/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ product_id: productId }),
            });
            fetchCart(); // Refresh cart after adding item
        } catch (error) {
            console.error('Error adding to cart:', error);   
        }

    };

    //Remove Product from Cart
    const removeFromCart = async (itemId) => {
        try {
            await authFetch(`${BASEURL}/api/cart/remove/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({item_id: itemId}),
            });
            fetchCart(); // Refresh cart after removing item
        } catch (error) {
            console.error('Error removing from cart:', error);
        }
    };


    //Update Quantity
    const updateQuantity = async (itemId, quantity) => {
        if (quantity < 1) {
           await removeFromCart(itemId);
        }
        try {
            await authFetch(`${BASEURL}/api/cart/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({item_id: itemId, quantity}),
            });
            fetchCart(); // Refresh cart after updating quantity
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    };

    const clearCart = () => {
        setCartItems([]);
        setTotal(0);
    }

    return (
        <CartContext.Provider value={{ cartItems, total, addToCart, removeFromCart, updateQuantity, clearCart }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);