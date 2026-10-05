import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../utils/auth.js";

const cardClass = "rounded-2xl bg-white p-5 shadow-sm";

function AdminOperations() {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadSummary = async () => {
            try {
                const response = await authFetch(`${BASEURL}/api/admin/operations/summary/`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || data.error || "Unable to load operations summary.");
                }
                if (active) setSummary(data);
            } catch (loadError) {
                if (active) setError(loadError.message);
            } finally {
                if (active) setLoading(false);
            }
        };

        void Promise.resolve().then(loadSummary);
        return () => {
            active = false;
        };
    }, [BASEURL]);

    const maxStatusCount = Math.max(
        1,
        ...(summary?.status_counts || []).map((entry) => entry.count),
    );

    return (
        <main className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                            Staff workspace
                        </p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Operations overview</h1>
                        <p className="mt-2 text-slate-600">
                            Daily order activity, paid card revenue, and inventory needing attention.
                        </p>
                    </div>
                    {summary && (
                        <p className="text-sm text-slate-500">
                            Updated for {new Date(`${summary.date}T00:00:00`).toLocaleDateString()}
                        </p>
                    )}
                </header>

                {error && (
                    <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </p>
                )}

                {loading ? (
                    <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
                        Loading operations summary...
                    </div>
                ) : summary ? (
                    <>
                        <section aria-label="Today's performance" className="grid gap-4 sm:grid-cols-2">
                            <article className={cardClass}>
                                <p className="text-sm font-semibold text-slate-500">Orders today</p>
                                <p className="mt-2 text-3xl font-black text-slate-900">{summary.today_orders}</p>
                            </article>
                            <article className={cardClass}>
                                <p className="text-sm font-semibold text-slate-500">Paid card revenue today</p>
                                <p className="mt-2 text-3xl font-black text-emerald-700">
                                    ${Number(summary.paid_revenue_today).toFixed(2)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Confirmed Stripe payments only; excludes unpaid and cash-on-delivery orders.
                                </p>
                            </article>
                        </section>

                        <section className="mt-6 grid gap-6 lg:grid-cols-2">
                            <article className={`${cardClass} p-6`}>
                                <h2 className="text-lg font-bold text-slate-900">Order status</h2>
                                <div className="mt-5 space-y-4">
                                    {summary.status_counts.map((entry) => (
                                        <div key={entry.value}>
                                            <div className="mb-1 flex justify-between gap-4 text-sm">
                                                <span className="text-slate-600">{entry.label}</span>
                                                <span className="font-semibold text-slate-900">{entry.count}</span>
                                            </div>
                                            <div
                                                className="h-2 overflow-hidden rounded-full bg-slate-100"
                                                role="meter"
                                                aria-label={`${entry.label} orders`}
                                                aria-valuemin={0}
                                                aria-valuemax={maxStatusCount}
                                                aria-valuenow={entry.count}
                                            >
                                                <div
                                                    className="h-full rounded-full bg-indigo-500"
                                                    style={{ width: `${(entry.count / maxStatusCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>

                            <article className={`${cardClass} p-6`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Low-stock alerts</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Products with {summary.low_stock_threshold} or fewer units.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
                                        {summary.low_stock_products.length}
                                    </span>
                                </div>
                                {summary.low_stock_products.length ? (
                                    <ul className="mt-4 divide-y divide-slate-100">
                                        {summary.low_stock_products.map((product) => (
                                            <li key={product.id} className="flex justify-between gap-4 py-3 text-sm">
                                                <span>
                                                    <span className="block font-semibold text-slate-800">{product.name}</span>
                                                    <span className="text-xs text-slate-500">{product.category}</span>
                                                </span>
                                                <span className="shrink-0 font-bold text-amber-700">
                                                    {product.stock_quantity} left
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                                        No products are below the stock threshold.
                                    </p>
                                )}
                            </article>
                        </section>

                        <Link
                            to="/admin/orders"
                            className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                        >
                            Open order fulfilment
                        </Link>
                    </>
                ) : null}
            </div>
        </main>
    );
}

export default AdminOperations;
