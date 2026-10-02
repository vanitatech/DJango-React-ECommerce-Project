import { createContext, useContext, useEffect, useState } from 'react';
import { authFetch, getAccessToken } from '../utils/auth';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [cartItems, setCartItems] = useState([]);
    const [total, setTotal] = useState(0);

    const fetchCart = async () => {
        if (!getAccessToken()) {
            setCartItems([]);
            setTotal(0);
            return;
        }

        try {
            const response = await authFetch(`${BASEURL}/api/cart/`);
            if (!response.ok) {
                throw new Error('Unable to fetch cart');
            }
            const data = await response.json();
            setCartItems(data.items || []);
            setTotal(Number(data.total || 0));
        } catch (error) {
            console.error('Error fetching cart:', error);
            setCartItems([]);
            setTotal(0);
        }
    };

    useEffect(() => {
        fetchCart();
    }, [BASEURL]);

    const addToCart = async (productId) => {
        try {
            await authFetch(`${BASEURL}/api/cart/add/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId }),
            });
            await fetchCart();
        } catch (error) {
            console.error('Error adding to cart:', error);
        }
    };

    const removeFromCart = async (itemId) => {
        try {
            await authFetch(`${BASEURL}/api/cart/remove/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId }),
            });
            await fetchCart();
        } catch (error) {
            console.error('Error removing from cart:', error);
        }
    };

    const updateQuantity = async (itemId, quantity) => {
        if (quantity < 1) {
            await removeFromCart(itemId);
            return;
        }

        try {
            await authFetch(`${BASEURL}/api/cart/update/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId, quantity }),
            });
            await fetchCart();
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    };

    const clearCart = () => {
        setCartItems([]);
        setTotal(0);
    };

    return (
        <CartContext.Provider value={{ cartItems, total, addToCart, removeFromCart, updateQuantity, clearCart }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
