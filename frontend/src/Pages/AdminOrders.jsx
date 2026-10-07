import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../utils/auth.js";
import { API_BASE } from "../utils/deployment.js";

const statusOptions = [
    ["", "All statuses"],
    ["AWAITING_PAYMENT", "Awaiting payment"],
    ["PROCESSING", "Processing"],
    ["SHIPPED", "Shipped"],
    ["DELIVERED", "Delivered"],
    ["CANCELLED", "Cancelled"],
];

const inputClass =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500";

function responseError(data, fallback) {
    if (data.error || data.detail) {
        return data.error || data.detail;
    }
    return Object.values(data).flat().join(" ") || fallback;
}

function AdminOrders() {
    const BASEURL = API_BASE;
    const [orders, setOrders] = useState([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("PROCESSING");
    const [shipmentDetails, setShipmentDetails] = useState({});
    const [loading, setLoading] = useState(true);
    const [updatingOrderId, setUpdatingOrderId] = useState(null);
    const [error, setError] = useState("");

    const loadOrders = useCallback(async (query = "", selectedStatus = "PROCESSING") => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set("search", query.trim());
            if (selectedStatus) params.set("status", selectedStatus);
            const response = await authFetch(
                `${BASEURL}/api/admin/orders/?${params.toString()}`,
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(responseError(data, "Unable to load the order queue."));
            }
            setOrders(data);
            setShipmentDetails((current) => {
                const updated = { ...current };
                for (const order of data) {
                    updated[order.id] = {
                        carrier: order.carrier || "",
                        tracking_number: order.tracking_number || "",
                    };
                }
                return updated;
            });
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [BASEURL]);

    useEffect(() => {
        void Promise.resolve().then(() => loadOrders());
    }, [loadOrders]);

    const updateOrder = async (order, changes) => {
        setUpdatingOrderId(order.id);
        setError("");
        try {
            const response = await authFetch(
                `${BASEURL}/api/admin/orders/${order.id}/`,
                {
                    method: "PATCH",
                    body: JSON.stringify(changes),
                },
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(responseError(data, "Unable to update this order."));
            }
            setOrders((current) => {
                if (status && data.status !== status) {
                    return current.filter((item) => item.id !== data.id);
                }
                return current.map((item) => item.id === data.id ? data : item);
            });
            setShipmentDetails((current) => ({
                ...current,
                [data.id]: {
                    carrier: data.carrier || "",
                    tracking_number: data.tracking_number || "",
                },
            }));
        } catch (updateError) {
            setError(updateError.message);
        } finally {
            setUpdatingOrderId(null);
        }
    };

    const handleSearch = (event) => {
        event.preventDefault();
        void loadOrders(search, status);
    };

    const setShipmentField = (orderId, field, value) => {
        setShipmentDetails((current) => ({
            ...current,
            [orderId]: {
                ...(current[orderId] || { carrier: "", tracking_number: "" }),
                [field]: value,
            },
        }));
    };

    return (
        <main className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                        Staff workspace
                    </p>
                    <h1 className="mt-2 text-3xl font-black text-slate-900">Order fulfilment</h1>
                    <p className="mt-2 text-slate-600">
                        Review customer orders, record shipment details, and move orders through fulfilment.
                    </p>
                </header>

                <form
                    onSubmit={handleSearch}
                    className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_14rem_auto]"
                >
                    <label className="sr-only" htmlFor="order-search">Search orders</label>
                    <input
                        id="order-search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Order number, customer, email, or phone"
                        className={inputClass}
                    />
                    <label className="sr-only" htmlFor="order-status">Filter by status</label>
                    <select
                        id="order-status"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className={inputClass}
                    >
                        {statusOptions.map(([value, label]) => (
                            <option key={value || "all"} value={value}>{label}</option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                        Search orders
                    </button>
                </form>

                {error && (
                    <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </p>
                )}

                {loading ? (
                    <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
                        Loading orders...
                    </div>
                ) : orders.length === 0 ? (
                    <div className="rounded-3xl bg-white p-10 text-center text-slate-600 shadow-sm">
                        No orders match these filters.
                    </div>
                ) : (
                    <div className="space-y-5">
                        {orders.map((order) => {
                            const shipment = shipmentDetails[order.id] || {
                                carrier: order.carrier || "",
                                tracking_number: order.tracking_number || "",
                            };
                            const canUpdate = ["PROCESSING", "SHIPPED"].includes(order.status);
                            const updating = updatingOrderId === order.id;

                            return (
                                <article key={order.id} className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900">Order #{order.id}</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Placed {new Date(order.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                                {order.status.replaceAll("_", " ").toLowerCase()}
                                            </span>
                                            <span className="font-bold text-slate-900">
                                                ${Number(order.total_amount).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid gap-5 border-b border-slate-100 py-5 text-sm md:grid-cols-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">Customer</h3>
                                            <p className="mt-1 text-slate-600">{order.customer_name || "Guest customer"}</p>
                                            <p className="text-slate-600">{order.customer_email || "No email provided"}</p>
                                            <p className="text-slate-600">{order.phone || "No phone provided"}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800">Delivery and payment</h3>
                                            <p className="mt-1 whitespace-pre-line text-slate-600">{order.shipping_address || "No delivery address provided"}</p>
                                            <p className="mt-2 text-slate-600">
                                                {order.payment_method === "COD" ? "Cash on delivery" : "Card"} ·{" "}
                                                {order.payment_status.replaceAll("_", " ").toLowerCase()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="py-5">
                                        <h3 className="font-semibold text-slate-800">Items</h3>
                                        <ul className="mt-2 divide-y divide-slate-100">
                                            {order.items.map((item) => (
                                                <li key={item.id} className="flex justify-between gap-4 py-2 text-sm">
                                                    <span className="text-slate-700">
                                                        {item.product_name || `Product ${item.product}`} × {item.quantity}
                                                    </span>
                                                    <span className="font-medium text-slate-800">
                                                        ${(Number(item.price) * item.quantity).toFixed(2)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {canUpdate ? (
                                        <div className="border-t border-slate-100 pt-5">
                                            <h3 className="font-semibold text-slate-800">Shipment details</h3>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Carrier and tracking number are optional, but must be entered together.
                                            </p>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Carrier
                                                    <input
                                                        value={shipment.carrier}
                                                        onChange={(event) => setShipmentField(order.id, "carrier", event.target.value)}
                                                        maxLength={100}
                                                        disabled={updating}
                                                        className={`${inputClass} mt-1 font-normal`}
                                                    />
                                                </label>
                                                <label className="text-sm font-medium text-slate-700">
                                                    Tracking number
                                                    <input
                                                        value={shipment.tracking_number}
                                                        onChange={(event) => setShipmentField(order.id, "tracking_number", event.target.value)}
                                                        maxLength={100}
                                                        disabled={updating}
                                                        className={`${inputClass} mt-1 font-normal`}
                                                    />
                                                </label>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => void updateOrder(order, shipment)}
                                                    disabled={updating}
                                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                >
                                                    Save shipment details
                                                </button>
                                                {order.status === "PROCESSING" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void updateOrder(order, {
                                                            ...shipment,
                                                            status: "SHIPPED",
                                                        })}
                                                        disabled={updating}
                                                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                                    >
                                                        {updating ? "Updating..." : "Mark as shipped"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => void updateOrder(order, { status: "DELIVERED" })}
                                                        disabled={updating}
                                                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        {updating ? "Updating..." : "Mark as delivered"}
                                                    </button>
                                                )}
                                            </div>
                                            {order.shipped_at && (
                                                <p className="mt-3 text-xs text-slate-500">
                                                    Shipped {new Date(order.shipped_at).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="border-t border-slate-100 pt-5 text-sm text-slate-600">
                                            {order.status === "AWAITING_PAYMENT" ? (
                                                <p>Payment is pending. Fulfilment actions are unavailable until payment is confirmed.</p>
                                            ) : order.status === "DELIVERED" ? (
                                                <p>Delivered {order.delivered_at ? new Date(order.delivered_at).toLocaleString() : ""}</p>
                                            ) : (
                                                <p>This order is cancelled and cannot be fulfilled.</p>
                                            )}
                                            {(order.carrier || order.tracking_number) && (
                                                <p className="mt-2">
                                                    {order.carrier} · Tracking {order.tracking_number}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}

export default AdminOrders;
