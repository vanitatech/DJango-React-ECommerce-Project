import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch, getAccessToken } from '../utils/auth';
import CartContext from './CartContextValue';
import { API_BASE, storageKey } from '../utils/deployment.js';

const GUEST_CART_KEY = storageKey('guest_cart');

const readGuestCart = () => {
    const savedCart = localStorage.getItem(GUEST_CART_KEY);
    if (!savedCart) {
        return [];
    }

    try {
        const parsedCart = JSON.parse(savedCart);
        return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
        console.error('Unable to restore guest cart:', error);
        return [];
    }
};

const getCartTotal = (items) => items.reduce(
    (sum, item) => sum + Number(item.product_price || 0) * item.quantity,
    0,
);

export const CartProvider = ({ children }) => {
    const BASEURL = API_BASE;
    const [cartItems, setCartItems] = useState(() => getAccessToken() ? [] : readGuestCart());
    const [total, setTotal] = useState(() => getAccessToken() ? 0 : getCartTotal(readGuestCart()));
    const guestCartSync = useRef(null);

    const fetchCart = useCallback(async () => {
        if (!getAccessToken()) {
            const guestItems = readGuestCart();
            setCartItems(guestItems);
            setTotal(getCartTotal(guestItems));
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
    }, [BASEURL]);

    const saveGuestCart = useCallback((items) => {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
        setCartItems(items);
        setTotal(getCartTotal(items));
    }, []);

    const syncGuestCart = useCallback(async () => {
        if (guestCartSync.current) {
            return guestCartSync.current;
        }

        guestCartSync.current = (async () => {
            const remainingItems = readGuestCart();
            const errors = [];
            for (const item of remainingItems) {
                try {
                    const response = await authFetch(`${BASEURL}/api/cart/add/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_id: item.product, quantity: item.quantity }),
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Unable to move guest cart item into your account.');
                    }
                    const updatedItems = readGuestCart().filter(
                        (guestItem) => String(guestItem.product) !== String(item.product),
                    );
                    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(updatedItems));
                } catch (error) {
                    console.error('Unable to move a guest cart item into the account cart:', error);
                    errors.push(error);
                }
            }
            await fetchCart();

            if (errors.length) {
                throw new Error('Some guest cart items could not be added to your account. Log out to review your saved guest cart before checking out.');
            }
        })().finally(() => {
            guestCartSync.current = null;
        });
        return guestCartSync.current;
    }, [BASEURL, fetchCart]);

    useEffect(() => {
        const handleAuthChange = () => {
            if (getAccessToken()) {
                void syncGuestCart().catch((error) => console.error(error));
            } else {
                void fetchCart();
            }
        };

        handleAuthChange();
        window.addEventListener('auth-change', handleAuthChange);
        window.addEventListener('storage', handleAuthChange);
        return () => {
            window.removeEventListener('auth-change', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
        };
    }, [fetchCart, syncGuestCart]);

    const addToCart = async (productId, quantity = 1) => {
        if (!getAccessToken()) {
            const response = await fetch(`${BASEURL}/api/products/${productId}/`);
            const product = await response.json();
            if (!response.ok) {
                throw new Error(product.error || 'Unable to load this product.');
            }

            const items = readGuestCart();
            const existingItem = items.find(
                (item) => String(item.product) === String(productId),
            );
            const nextQuantity = (existingItem?.quantity || 0) + quantity;
            if (nextQuantity > product.stock_quantity) {
                throw new Error(`Only ${Math.max(product.stock_quantity - (existingItem?.quantity || 0), 0)} units are available to add.`);
            }

            const image = product.external_image_url || product.image || '';
            const nextItem = {
                id: `guest-${product.id}`,
                product: product.id,
                product_name: product.name,
                product_price: product.price,
                product_image: image,
                product_external_image_url: product.external_image_url,
                product_stock: product.stock_quantity,
                quantity: nextQuantity,
            };
            const updatedItems = existingItem
                ? items.map((item) => String(item.product) === String(productId) ? nextItem : item)
                : [...items, nextItem];
            saveGuestCart(updatedItems);
            return { message: 'Product added to guest cart' };
        }

        try {
            const response = await authFetch(`${BASEURL}/api/cart/add/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId, quantity }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Unable to add product to cart');
            }
            await fetchCart();
            return data;
        } catch (error) {
            console.error('Error adding to cart:', error);
            throw error;
        }
    };

    const removeFromCart = async (itemId) => {
        if (!getAccessToken()) {
            saveGuestCart(readGuestCart().filter((item) => item.id !== itemId));
            return;
        }

        try {
            const response = await authFetch(`${BASEURL}/api/cart/remove/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Unable to remove this item from your cart.');
            }
            await fetchCart();
        } catch (error) {
            console.error('Error removing from cart:', error);
            throw error;
        }
    };

    const updateQuantity = async (itemId, quantity) => {
        if (quantity < 1) {
            await removeFromCart(itemId);
            return;
        }

        if (!getAccessToken()) {
            const items = readGuestCart();
            const item = items.find((cartItem) => cartItem.id === itemId);
            if (!item) {
                throw new Error('Cart item not found.');
            }
            if (quantity > item.product_stock) {
                throw new Error(`Only ${item.product_stock} units are currently available.`);
            }
            saveGuestCart(items.map((cartItem) => (
                cartItem.id === itemId ? { ...cartItem, quantity } : cartItem
            )));
            return;
        }

        try {
            const response = await authFetch(`${BASEURL}/api/cart/update/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId, quantity }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Unable to update this item quantity.');
            }
            await fetchCart();
        } catch (error) {
            console.error('Error updating quantity:', error);
            throw error;
        }
    };

    const clearCart = useCallback(() => {
        if (!getAccessToken()) {
            localStorage.removeItem(GUEST_CART_KEY);
        }
        setCartItems([]);
        setTotal(0);
    }, []);

    return (
        <CartContext.Provider value={{ cartItems, total, addToCart, removeFromCart, updateQuantity, clearCart, syncGuestCart }}>
            {children}
        </CartContext.Provider>
    );
};
