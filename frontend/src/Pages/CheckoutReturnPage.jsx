import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../context/useCart.js";
import { authFetch } from "../utils/auth.js";
import { API_BASE, storageKey } from "../utils/deployment.js";

function CheckoutReturnPage() {
    const BASEURL = API_BASE;
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const { clearCart } = useCart();
    const [retryCount, setRetryCount] = useState(0);
    const [result, setResult] = useState({
        state: sessionId ? "checking" : "error",
        order: null,
        error: sessionId ? "" : "The payment session is missing.",
    });
    const paymentResult = sessionId
        ? result
        : { state: "error", order: null, error: "The payment session is missing." };

    useEffect(() => {
        let active = true;
        let timer;
        let attempts = 0;

        if (!sessionId) {
            return undefined;
        }

        const checkPayment = async () => {
            attempts += 1;
            try {
                const response = await authFetch(
                    `${BASEURL}/api/orders/payment-status/?session_id=${encodeURIComponent(sessionId)}`,
                );
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Unable to verify your payment.");
                }
                if (!active) {
                    return;
                }

                if (data.payment_status === "PAID") {
                    clearCart();
                    setResult({ state: "paid", order: data, error: "" });
                    return;
                }
                if (data.payment_status === "FAILED" || data.status === "CANCELLED") {
                    setResult({ state: "failed", order: data, error: "" });
                    return;
                }
                if (attempts >= 15) {
                    setResult({ state: "pending", order: data, error: "" });
                    return;
                }

                setResult({ state: "checking", order: data, error: "" });
                timer = setTimeout(checkPayment, 2000);
            } catch (error) {
                if (active) {
                    setResult({ state: "error", order: null, error: error.message });
                }
            }
        };

        void checkPayment();
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [BASEURL, clearCart, retryCount, sessionId]);

    const retryPaymentCheck = () => {
        setResult({ state: "checking", order: null, error: "" });
        setRetryCount((count) => count + 1);
    };

    return (
        <main className="min-h-[70vh] bg-slate-100 px-6 py-12">
            <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg">
                {paymentResult.state === "checking" && (
                    <>
                        <p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Verifying payment</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Confirming your order</h1>
                        <p className="mt-3 text-slate-600">We’re checking your payment directly with Stripe. This can take a few moments.</p>
                    </>
                )}
                {paymentResult.state === "paid" && (
                    <>
                        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Payment confirmed</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Thank you for your order!</h1>
                        <p className="mt-3 text-slate-700">Order <strong>#{paymentResult.order.order_id}</strong> is confirmed.</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">Total: ${Number(paymentResult.order.total).toFixed(2)}</p>
                        <p className="mt-2 text-sm text-slate-600">A receipt will be sent by Stripe to the email used at checkout.</p>
                        {paymentResult.order.order_id
                            && sessionStorage.getItem(storageKey(`guest_order_tracking_${paymentResult.order.order_id}`))
                            && (
                                <Link
                                    to={`/orders/track/${encodeURIComponent(sessionStorage.getItem(storageKey(`guest_order_tracking_${paymentResult.order.order_id}`)))}`}
                                    className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
                                >
                                    Track this order
                                </Link>
                            )}
                    </>
                )}
                {paymentResult.state === "failed" && (
                    <>
                        <p className="text-sm font-bold uppercase tracking-wider text-amber-700">Payment not completed</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Your order was not placed</h1>
                        <p className="mt-3 text-slate-600">The checkout session expired or the payment failed. Reserved stock has been released.</p>
                    </>
                )}
                {paymentResult.state === "pending" && (
                    <>
                        <p className="text-sm font-bold uppercase tracking-wider text-amber-700">Payment is still pending</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">We’re still confirming your order</h1>
                        <p className="mt-3 text-slate-600">Your payment has not been confirmed yet. Please check again before placing another order.</p>
                        {paymentResult.order?.checkout_url && (
                            <a
                                href={paymentResult.order.checkout_url}
                                className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
                            >
                                Return to secure checkout
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={retryPaymentCheck}
                            className="mt-5 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Check payment again
                        </button>
                    </>
                )}
                {paymentResult.state === "error" && (
                    <>
                        <p className="text-sm font-bold uppercase tracking-wider text-red-700">Could not verify payment</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Payment status unavailable</h1>
                        <p role="alert" className="mt-3 text-slate-600">{paymentResult.error}</p>
                        {sessionId && (
                            <button
                                type="button"
                                onClick={retryPaymentCheck}
                                className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
                            >
                                Check payment again
                            </button>
                        )}
                    </>
                )}
                {paymentResult.state !== "checking" && (
                    <Link to="/" className="mt-6 inline-flex rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50">
                        Continue shopping
                    </Link>
                )}
            </section>
        </main>
    );
}

export default CheckoutReturnPage;
