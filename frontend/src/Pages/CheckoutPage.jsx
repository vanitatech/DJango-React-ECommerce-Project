import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/useCart.js";
import { authFetch } from "../utils/auth.js";

function CheckoutPage() {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const navigate = useNavigate();
    const { clearCart } = useCart();

    const [form, setForm] = useState({
        name: "",
        address: "",
        phone: "",
        payment_method: "COD",
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((previous) => ({ ...previous, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const response = await authFetch(`${BASEURL}/api/orders/create/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
            });

            const data = await response.json();

            if (response.ok) {
                clearCart();
                setMessage(`Order #${data.order_id} placed successfully! Redirecting to your orders...`);
                setTimeout(() => navigate("/orders"), 1500);
                return;
            }

            setMessage(data.error || "Failed to place order. Please try again.");
        } catch {
            setMessage("An error occurred while placing your order. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-lg">
                <h1 className="mb-6 text-center text-3xl font-black text-slate-900">Checkout</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Full name"
                        required
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                    />

                    <textarea
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        placeholder="Shipping address"
                        required
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                        rows="4"
                    />

                    <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="Phone number"
                        required
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                    />

                    <select
                        name="payment_method"
                        value={form.payment_method}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500"
                    >
                        <option value="COD">Cash on delivery</option>
                        <option value="CARD">Card (demo only; no payment processed)</option>
                    </select>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                        {loading ? 'Processing...' : 'Place order'}
                    </button>
                </form>

                {message && (
                    <p className={`mt-4 text-center text-sm font-medium ${message.startsWith('Order placed') ? 'text-emerald-600' : 'text-red-600'}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}

export default CheckoutPage;
