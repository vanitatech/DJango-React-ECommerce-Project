import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function GuestOrderTracking() {
    const { token } = useParams();
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadOrder = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(
                    `${BASEURL}/api/orders/track/`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token }),
                    },
                );
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "This tracking link is invalid.");
                }
                if (active) setOrder(data);
            } catch (loadError) {
                if (active) {
                    setOrder(null);
                    setError(loadError.message);
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadOrder();
        return () => {
            active = false;
        };
    }, [BASEURL, token]);

    const statusLabel = order?.status.replaceAll("_", " ").toLowerCase();

    return (
        <main className="min-h-[70vh] bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-2xl">
                {loading ? (
                    <section className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
                        Looking up your order...
                    </section>
                ) : error ? (
                    <section className="rounded-3xl bg-white p-10 text-center shadow-sm">
                        <p className="text-sm font-bold uppercase tracking-wider text-red-700">
                            Private tracking link
                        </p>
                        <h1 className="mt-2 text-2xl font-black text-slate-900">
                            Order not found
                        </h1>
                        <p role="alert" className="mt-3 text-slate-600">
                            {error} Check that you opened the complete link from your order confirmation.
                        </p>
                        <Link to="/" className="mt-5 inline-flex font-semibold text-indigo-600 hover:underline">
                            Return to the store
                        </Link>
                    </section>
                ) : (
                    <section className="rounded-3xl bg-white p-6 shadow-sm md:p-9">
                        <p className="text-sm font-bold uppercase tracking-wider text-indigo-600">
                            Guest order tracking
                        </p>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h1 className="text-3xl font-black text-slate-900">Order #{order.id}</h1>
                            <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold capitalize text-indigo-700">
                                {statusLabel}
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                            Placed {new Date(order.created_at).toLocaleDateString()}
                        </p>

                        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                            <h2 className="font-bold text-slate-900">Delivery updates</h2>
                            {order.carrier && (
                                <p className="mt-3 text-sm text-slate-600">Carrier: {order.carrier}</p>
                            )}
                            {order.tracking_number && (
                                <p className="text-sm text-slate-600">Tracking number: {order.tracking_number}</p>
                            )}
                            {order.shipped_at && (
                                <p className="mt-2 text-sm text-slate-500">
                                    Shipped {new Date(order.shipped_at).toLocaleString()}
                                </p>
                            )}
                            {order.delivered_at && (
                                <p className="text-sm text-slate-500">
                                    Delivered {new Date(order.delivered_at).toLocaleString()}
                                </p>
                            )}
                            {!order.carrier && !order.shipped_at && (
                                <p className="mt-2 text-sm text-slate-600">
                                    {order.status === "CANCELLED"
                                        ? "This order was cancelled."
                                        : "Shipment details will appear here when your order ships."}
                                </p>
                            )}
                        </div>

                        <div className="mt-6">
                            <h2 className="font-bold text-slate-900">Items</h2>
                            <ul className="mt-2 divide-y divide-slate-100">
                                {order.items.map((item) => (
                                    <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                                        <span className="text-slate-700">
                                            {item.product_name || `Product ${item.product}`} × {item.quantity}
                                        </span>
                                        <span className="font-medium text-slate-800">
                                            ${(Number(item.price) * item.quantity).toFixed(2)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex justify-between border-t border-slate-100 pt-4 font-bold text-slate-900">
                                <span>Order total</span>
                                <span>${Number(order.total_amount).toFixed(2)}</span>
                            </div>
                        </div>
                        <p className="mt-6 text-xs text-slate-500">
                            This private link grants access to limited order status information. Keep it to yourself.
                        </p>
                    </section>
                )}
            </div>
        </main>
    );
}

export default GuestOrderTracking;
