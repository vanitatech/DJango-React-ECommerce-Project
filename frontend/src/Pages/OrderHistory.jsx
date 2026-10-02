import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../utils/auth.js";

function OrderHistory() {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadOrders = async () => {
            try {
                const response = await authFetch(`${BASEURL}/api/orders/`);
                if (!response.ok) {
                    throw new Error("Unable to load your order history.");
                }
                setOrders(await response.json());
            } catch (loadError) {
                setError(loadError.message);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, [BASEURL]);

    return (
        <main className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Your account</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Order history</h1>
                    </div>
                    <Link to="/" className="text-sm font-semibold text-indigo-600 hover:underline">Continue shopping</Link>
                </div>

                {loading ? (
                    <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading your orders...</div>
                ) : error ? (
                    <div role="alert" className="rounded-3xl bg-white p-10 text-center text-red-600 shadow-sm">{error}</div>
                ) : orders.length === 0 ? (
                    <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                        <p className="text-lg font-semibold text-slate-800">No orders yet</p>
                        <p className="mt-2 text-sm text-slate-500">Your completed checkouts will appear here.</p>
                        <Link to="/" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
                            Explore products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {orders.map((order) => (
                            <article key={order.id} className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                                <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Order #{order.id}</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Placed {new Date(order.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                            {order.status.toLowerCase()}
                                        </span>
                                        <span className="text-lg font-bold text-slate-900">${Number(order.total_amount).toFixed(2)}</span>
                                    </div>
                                </div>

                                <ul className="divide-y divide-slate-100">
                                    {order.items.map((item) => (
                                        <li key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                                            <span className="font-medium text-slate-700">
                                                {item.product_name || `Product ${item.product}`} <span className="text-slate-400">× {item.quantity}</span>
                                            </span>
                                            <span className="shrink-0 font-semibold text-slate-800">
                                                ${(Number(item.price) * item.quantity).toFixed(2)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                                    <p className="text-slate-500">
                                        <span className="font-medium text-slate-700">Ship to:</span> {order.customer_name}, {order.shipping_address}
                                    </p>
                                    <p className="text-slate-500 sm:text-right">
                                        <span className="font-medium text-slate-700">Payment:</span> {order.payment_method === "COD" ? "Cash on delivery" : "Card (demo)"}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

export default OrderHistory;
