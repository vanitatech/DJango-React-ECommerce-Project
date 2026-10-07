import { useState } from 'react';
import { Link } from "react-router-dom";
import { useCart } from "../context/useCart.js";
import { mediaUrl } from "../utils/deployment.js";

function CartPage() {
    const { cartItems, total, removeFromCart, updateQuantity } = useCart();
    const [pendingItemId, setPendingItemId] = useState(null);
    const [actionError, setActionError] = useState({ itemId: null, message: '' });

    const runCartAction = async (itemId, action) => {
        setPendingItemId(itemId);
        setActionError({ itemId: null, message: '' });
        try {
            await action();
        } catch (error) {
            setActionError({ itemId, message: error.message });
        } finally {
            setPendingItemId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-8 text-center text-3xl font-black text-slate-900">Your cart</h1>

                {cartItems.length === 0 ? (
                    <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
                        <p className="text-lg text-slate-600">Your cart is empty.</p>
                        <Link to="/" className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700">
                            Continue shopping
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                        <div className="space-y-5">
                            {cartItems.map((item) => (
                                <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-4">
                                        {item.product_external_image_url || item.product_image ? (
                                            <img
                                                src={item.product_external_image_url || mediaUrl(item.product_image)}
                                                alt={item.product_name}
                                                className="h-20 w-20 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-xl">
                                                🛍️
                                            </div>
                                        )}

                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-800">{item.product_name}</h2>
                                            <p className="text-sm text-slate-500">${Number(item.product_price || 0).toFixed(2)} each</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800" aria-label={`Line total $${(Number(item.product_price || 0) * item.quantity).toFixed(2)}`}>
                                                Line total: ${(Number(item.product_price || 0) * item.quantity).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            className="h-9 w-9 rounded-full bg-slate-200 font-bold text-slate-700 hover:bg-slate-300 disabled:cursor-wait disabled:opacity-50"
                                            onClick={() => runCartAction(item.id, () => updateQuantity(item.id, item.quantity - 1))}
                                            aria-label="Decrease quantity"
                                            disabled={pendingItemId === item.id}
                                        >
                                            -
                                        </button>
                                        <span className="w-6 text-center font-medium">{item.quantity}</span>
                                        <button
                                            className="h-9 w-9 rounded-full bg-slate-200 font-bold text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                            onClick={() => runCartAction(item.id, () => updateQuantity(item.id, item.quantity + 1))}
                                            aria-label="Increase quantity"
                                            disabled={pendingItemId === item.id || item.quantity >= item.product_stock}
                                        >
                                            +
                                        </button>
                                        <button
                                            className="ml-3 text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-50"
                                            onClick={() => runCartAction(item.id, () => removeFromCart(item.id))}
                                            disabled={pendingItemId === item.id}
                                        >
                                            {pendingItemId === item.id ? 'Updating...' : 'Remove'}
                                        </button>
                                    </div>
                                    {actionError.itemId === item.id && (
                                        <p role="alert" className="text-sm text-red-600">{actionError.message}</p>
                                    )}
                                    {item.quantity >= item.product_stock && (
                                        <p className="text-xs text-amber-700">Maximum available quantity reached.</p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Total</p>
                                <p className="text-3xl font-black text-slate-900">${Number(total || 0).toFixed(2)}</p>
                            </div>

                            <Link
                                to="/checkout"
                                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700"
                            >
                                Proceed to checkout
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CartPage;
