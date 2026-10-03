import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/useCart.js";
import { authFetch, getAccessToken } from "../utils/auth.js";

function ProductDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [productResult, setProductResult] = useState({ id: null, product: null, error: null });
    const [reviews, setReviews] = useState([]);
    const [reviewsProductId, setReviewsProductId] = useState(null);
    const [reviewError, setReviewError] = useState("");
    const [reviewMessage, setReviewMessage] = useState("");
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: "5", comment: "" });
    const [addQuantity, setAddQuantity] = useState(1);
    const [cartAdding, setCartAdding] = useState(false);
    const [cartError, setCartError] = useState("");
    const [cartMessage, setCartMessage] = useState("");
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [wishlistProductId, setWishlistProductId] = useState(null);
    const [wishlistUpdating, setWishlistUpdating] = useState(false);
    const [wishlistError, setWishlistError] = useState("");
    const [wishlistMessage, setWishlistMessage] = useState("");
    const { addToCart, cartItems } = useCart();

    const loadProduct = useCallback(async () => {
        const response = await fetch(`${BASEURL}/api/products/${id}/`);
        if (!response.ok) {
            throw new Error("Failed to fetch product details");
        }
        return response.json();
    }, [BASEURL, id]);

    const loadReviews = useCallback(async () => {
        try {
            const response = await fetch(`${BASEURL}/api/products/${id}/reviews/`);
            if (!response.ok) {
                throw new Error("Failed to fetch product reviews");
            }
            const data = await response.json();
            setReviewError("");
            setReviews(data);
        } catch (fetchError) {
            setReviewError(fetchError.message);
        } finally {
            setReviewsProductId(id);
        }
    }, [BASEURL, id]);

    const loadWishlistState = useCallback(async () => {
        if (!getAccessToken()) {
            setIsWishlisted(false);
            setWishlistProductId(id);
            return;
        }
        try {
            const response = await authFetch(`${BASEURL}/api/wishlist/`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Unable to check saved products.");
            }
            setIsWishlisted(data.some((savedProduct) => String(savedProduct.id) === id));
            setWishlistError("");
        } catch (wishlistLoadError) {
            setWishlistError(wishlistLoadError.message);
        } finally {
            setWishlistProductId(id);
        }
    }, [BASEURL, id]);

    useEffect(() => {
        let active = true;
        loadProduct()
            .then((data) => {
                if (active) {
                    setProductResult({ id, product: data, error: null });
                }
            })
            .catch((fetchError) => {
                if (active) {
                    setProductResult({ id, product: null, error: fetchError.message });
                }
            });
        void Promise.resolve().then(loadReviews);
            void Promise.resolve().then(loadWishlistState);

        return () => {
            active = false;
        };
    }, [id, loadProduct, loadReviews, loadWishlistState]);

    const handleAddToCart = async () => {
        if (!getAccessToken()) {
            navigate("/login", { state: { from: { pathname: `/product/${id}` } } });
            return;
        }

        setCartAdding(true);
        setCartMessage("");
        setCartError("");
        try {
            await addToCart(product.id, selectedAddQuantity);
            setCartMessage(`Added ${selectedAddQuantity} ${selectedAddQuantity === 1 ? "item" : "items"} to your cart.`);
        } catch (cartError) {
            setCartError(cartError.message);
        } finally {
            setCartAdding(false);
        }
    };

    const handleReviewSubmit = async (event) => {
        event.preventDefault();
        setReviewSubmitting(true);
        setReviewMessage("");
        setReviewError("");
        try {
            const response = await authFetch(`${BASEURL}/api/products/${id}/reviews/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rating: Number(reviewForm.rating),
                    comment: reviewForm.comment,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.detail || "Unable to submit your review.");
            }

            setReviews((previous) => [data, ...previous]);
            setReviewForm({ rating: "5", comment: "" });
            setReviewMessage("Thanks for sharing your review.");
            const refreshedProduct = await loadProduct();
            setProductResult({ id, product: refreshedProduct, error: null });
        } catch (submitError) {
            setReviewError(submitError.message);
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleWishlistToggle = async () => {
        if (!getAccessToken()) {
            navigate("/login");
            return;
        }

        setWishlistUpdating(true);
        setWishlistError("");
        setWishlistMessage("");
        try {
            const response = await authFetch(`${BASEURL}/api/wishlist/${id}/`, {
                method: isWishlisted ? "DELETE" : "POST",
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || data.detail || "Unable to update your saved products.");
            }
            setIsWishlisted(!isWishlisted);
            setWishlistMessage(isWishlisted ? "Removed from your saved products." : "Saved to your wishlist.");
        } catch (wishlistUpdateError) {
            setWishlistError(wishlistUpdateError.message);
        } finally {
            setWishlistUpdating(false);
        }
    };

    const currentProductResult = productResult.id === id ? productResult : null;
    const product = currentProductResult?.product;
    const error = currentProductResult?.error;
    const reviewsLoading = reviewsProductId !== id;

    if (!currentProductResult) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">Loading product...</div>;
    }

    if (error) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-red-600">Error: {error}</div>;
    }

    if (!product) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">No product found.</div>;
    }

    const imageSrc = product.image
        ? product.image.startsWith("http")
            ? product.image
            : `${BASEURL}${product.image}`
        : "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80";
    const productImage = product.external_image_url || imageSrc;
    const productCartItem = cartItems.find((item) => item.product === product.id);
    const cartQuantity = productCartItem?.quantity || 0;
    const availableToAdd = Math.max(product.stock_quantity - cartQuantity, 0);
    const selectedAddQuantity = Math.min(addQuantity, Math.max(availableToAdd, 1));

    return (
        <div className="min-h-screen bg-slate-100 py-12">
            <div className="mx-auto max-w-6xl px-6">
                <Link to="/" className="mb-6 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    ← Back to shop
                </Link>

                <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="p-6 md:p-8">
                            <img src={productImage} alt={product.name} className="h-full min-h-[360px] w-full rounded-2xl object-cover" />
                        </div>

                        <div className="flex flex-col justify-center p-6 md:p-10">
                            <span className="mb-3 inline-flex w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                                {product.category?.name || "Featured"}
                            </span>
                            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">{product.name}</h1>
                            <p className="mt-4 text-xl font-bold text-slate-900">${Number(product.price || 0).toFixed(2)}</p>
                            <p className="mt-5 text-base leading-relaxed text-slate-600">{product.description}</p>
                            <p className={`mt-3 text-sm font-medium ${availableToAdd > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                                {availableToAdd > 0
                                    ? `${availableToAdd} available to add${cartQuantity ? ` · ${cartQuantity} already in your cart` : ""}`
                                    : cartQuantity
                                        ? "All available units are already in your cart"
                                        : "Currently out of stock"}
                            </p>

                            <div className="mt-8 flex flex-wrap gap-4">
                                <label htmlFor="add-quantity" className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                    Quantity
                                    <input
                                        id="add-quantity"
                                        type="number"
                                        min="1"
                                        max={availableToAdd}
                                        value={selectedAddQuantity}
                                        onChange={(event) => {
                                            const nextQuantity = event.target.valueAsNumber;
                                            if (Number.isFinite(nextQuantity)) {
                                                setAddQuantity(Math.max(1, nextQuantity));
                                            }
                                        }}
                                        disabled={availableToAdd < 1 || cartAdding}
                                        className="w-20 rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500 disabled:bg-slate-100"
                                    />
                                </label>
                                <button
                                    onClick={handleAddToCart}
                                    disabled={availableToAdd < 1 || cartAdding}
                                    className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {cartAdding ? "Adding..." : "Add to Cart"}
                                </button>
                                <Link to="/cart" className="rounded-xl border border-slate-200 px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50">
                                    View cart
                                </Link>
                            </div>
                            {(cartMessage || cartError) && (
                                <p role={cartError ? "alert" : "status"} className={`mt-3 text-sm ${cartError ? "text-red-600" : "text-emerald-700"}`}>
                                    {cartError || cartMessage}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleWishlistToggle}
                                disabled={wishlistUpdating || wishlistProductId !== id}
                                aria-pressed={isWishlisted}
                                className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-700 hover:text-indigo-700 disabled:cursor-wait disabled:text-slate-400"
                            >
                                <span aria-hidden="true">{isWishlisted ? "♥" : "♡"}</span>
                                {wishlistUpdating
                                    ? "Updating saved products..."
                                    : isWishlisted
                                        ? "Remove from wishlist"
                                        : "Save to wishlist"}
                            </button>
                            {(wishlistMessage || wishlistError) && (
                                <p role={wishlistError ? "alert" : "status"} className={`mt-1 text-sm ${wishlistError ? "text-red-600" : "text-emerald-700"}`}>
                                    {wishlistError || wishlistMessage}
                                </p>
                            )}
                            {(reviewMessage || reviewError) && (
                                <p role="status" className={`mt-4 text-sm ${reviewError ? "text-red-600" : "text-emerald-700"}`}>
                                    {reviewError || reviewMessage}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Customer reviews</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {product.review_count
                                        ? `★ ${product.average_rating} average from ${product.review_count} ${product.review_count === 1 ? "review" : "reviews"}`
                                        : "Be the first to review this product."}
                                </p>
                            </div>
                        </div>

                        {reviewsLoading ? (
                            <p className="text-sm text-slate-500">Loading reviews...</p>
                        ) : reviewError && reviews.length === 0 ? (
                            <p role="alert" className="text-sm text-red-600">{reviewError}</p>
                        ) : reviews.length === 0 ? (
                            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No reviews have been submitted yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {reviews.map((review) => (
                                    <article key={review.id} className="rounded-2xl border border-slate-200 p-5">
                                        <div className="flex items-center justify-between gap-4">
                                            <h3 className="font-semibold text-slate-800">{review.username}</h3>
                                            <span className="text-sm font-semibold text-amber-600" aria-label={`${review.rating} out of 5 stars`}>
                                                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                                            </span>
                                        </div>
                                        {review.comment && <p className="mt-3 text-sm leading-relaxed text-slate-600">{review.comment}</p>}
                                        <time className="mt-3 block text-xs text-slate-400" dateTime={review.created_at}>
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </time>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900">Leave a review</h2>
                        {getAccessToken() ? (
                            <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
                                <label className="block text-sm font-medium text-slate-700">
                                    Your rating
                                    <select
                                        value={reviewForm.rating}
                                        onChange={(event) => setReviewForm((previous) => ({ ...previous, rating: event.target.value }))}
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                    >
                                        {[5, 4, 3, 2, 1].map((rating) => (
                                            <option key={rating} value={rating}>{rating} out of 5 stars</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                    Comment
                                    <textarea
                                        value={reviewForm.comment}
                                        onChange={(event) => setReviewForm((previous) => ({ ...previous, comment: event.target.value }))}
                                        maxLength={1000}
                                        rows={4}
                                        placeholder="What did you think?"
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                    />
                                </label>
                                <button
                                    type="submit"
                                    disabled={reviewSubmitting}
                                    className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {reviewSubmitting ? "Submitting..." : "Submit review"}
                                </button>
                            </form>
                        ) : (
                            <p className="mt-3 text-sm text-slate-600">
                                <Link to="/login" className="font-semibold text-indigo-600 hover:underline">Log in</Link> to share your review.
                            </p>
                        )}
                    </aside>
                </section>
            </div>
        </div>
    );
}

export default ProductDetails;
