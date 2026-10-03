import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/useCart.js";
import { authFetch, getAccessToken } from "../utils/auth.js";

function CheckoutPage() {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const navigate = useNavigate();
    const { cartItems, total, clearCart, syncGuestCart } = useCart();
    const isAuthenticated = Boolean(getAccessToken());

    const [form, setForm] = useState({
        name: "",
        email: "",
        address: "",
        phone: "",
        payment_method: "COD",
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const [profileNotice, setProfileNotice] = useState("");
    const [orderConfirmation, setOrderConfirmation] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            return undefined;
        }

        let active = true;
        const loadSavedDeliveryDetails = async () => {
            try {
                const response = await authFetch(`${BASEURL}/api/profile/`);
                if (!response.ok) {
                    throw new Error("Unable to load saved delivery details.");
                }
                const profile = await response.json();
                if (active) {
                    setForm((current) => ({
                        ...current,
                        email: current.email || profile.email || "",
                        address: current.address || profile.address || "",
                        phone: current.phone || profile.phone || "",
                    }));
                }
            } catch (error) {
                console.error("Unable to load saved delivery details:", error);
                if (active) {
                    setProfileNotice("Saved delivery details couldn't be loaded. You can enter them below.");
                }
            }
        };

        void loadSavedDeliveryDetails();
        return () => {
            active = false;
        };
    }, [BASEURL, isAuthenticated]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((previous) => ({ ...previous, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage("");
        setMessageType("");

        try {
            if (isAuthenticated) {
                await syncGuestCart();
            }

            const response = await authFetch(`${BASEURL}/api/orders/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    ...(!isAuthenticated && {
                        items: cartItems.map((item) => ({
                            product_id: item.product,
                            quantity: item.quantity,
                        })),
                    }),
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to place order. Please try again.");
            }

            clearCart();
            if (isAuthenticated) {
                setMessage(`Order #${data.order_id} placed successfully! Redirecting to your orders...`);
                setMessageType("success");
                setTimeout(() => navigate("/orders"), 1500);
            } else {
                setOrderConfirmation({
                    id: data.order_id,
                    total: data.total,
                    email: form.email,
                });
            }
        } catch (error) {
            setMessage(error.message || "An error occurred while placing your order. Please try again.");
            setMessageType("error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-lg">
                <h1 className="mb-6 text-center text-3xl font-black text-slate-900">Checkout</h1>

                {orderConfirmation ? (
                    <section
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
                        aria-labelledby="order-confirmation-heading"
                    >
                        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Order confirmed</p>
                        <h2 id="order-confirmation-heading" className="mt-2 text-2xl font-black text-slate-900">
                            Thank you for your order!
                        </h2>
                        <p className="mt-3 text-slate-700">
                            Order <span className="font-bold">#{orderConfirmation.id}</span> has been placed.
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            Total: ${Number(orderConfirmation.total).toFixed(2)}
                        </p>
                        <p className="mt-3 text-sm text-slate-600">
                            Your order details are associated with {orderConfirmation.email}.
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                            Create an account for faster future checkouts. An account is not required for this order.
                        </p>
                        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link
                                to={`/signup?email=${encodeURIComponent(orderConfirmation.email)}`}
                                className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
                            >
                                Create an account
                            </Link>
                            <Link
                                to="/"
                                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-white"
                            >
                                Continue shopping
                            </Link>
                        </div>
                    </section>
                ) : (
                    <>
                        {!isAuthenticated && (
                            <p className="mb-5 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
                                Checking out as a guest. You do not need to create an account.
                            </p>
                        )}

                        <section aria-labelledby="order-summary-heading" className="mb-6 rounded-2xl bg-slate-50 p-5">
                            <h2 id="order-summary-heading" className="mb-4 text-lg font-bold text-slate-900">Order summary</h2>
                            {cartItems.length ? (
                                <>
                                    <ul className="space-y-3">
                                        {cartItems.map((item) => (
                                            <li key={item.id} className="flex justify-between gap-4 text-sm">
                                                <span className="text-slate-600">
                                                    {item.product_name} <span className="text-slate-400">× {item.quantity}</span>
                                                </span>
                                                <span className="shrink-0 font-medium text-slate-800">
                                                    ${(Number(item.product_price || 0) * item.quantity).toFixed(2)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-bold text-slate-900">
                                        <span>Total</span>
                                        <span>${Number(total || 0).toFixed(2)}</span>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <p className="text-sm text-slate-600">Your cart is empty.</p>
                                    <Link to="/cart" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                                        Return to cart
                                    </Link>
                                </div>
                            )}
                        </section>

                        {isAuthenticated && profileNotice && (
                            <p role="status" className="mb-4 text-sm text-amber-700">{profileNotice}</p>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                id="checkout-email"
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="Email address"
                                aria-label="Email address"
                                required={!isAuthenticated}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                            />
                            <input
                                id="checkout-name"
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="Full name"
                                aria-label="Full name"
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                            />
                            <textarea
                                id="checkout-address"
                                name="address"
                                value={form.address}
                                onChange={handleChange}
                                placeholder="Shipping address"
                                aria-label="Shipping address"
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                                rows="4"
                            />
                            <input
                                id="checkout-phone"
                                type="tel"
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                placeholder="Phone number"
                                aria-label="Phone number"
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                            />
                            <select
                                id="checkout-payment-method"
                                name="payment_method"
                                value={form.payment_method}
                                onChange={handleChange}
                                aria-label="Payment method"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                            >
                                <option value="COD">Cash on delivery</option>
                                <option value="CARD">Card (demo only; no payment processed)</option>
                            </select>
                            <button
                                type="submit"
                                disabled={loading || cartItems.length === 0}
                                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            >
                                {loading ? "Processing..." : "Place order"}
                            </button>
                        </form>

                        {messageType === "success" && <p role="status" className="mt-4 text-center text-sm font-medium text-emerald-600">{message}</p>}
                        {messageType === "error" && <p role="alert" className="mt-4 text-center text-sm font-medium text-red-600">{message}</p>}
                    </>
                )}
            </div>
        </div>
    );
}

export default CheckoutPage;
