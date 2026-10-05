import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { authFetch } from "../utils/auth.js";

function WishlistPage() {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [removingProductId, setRemovingProductId] = useState(null);
    const [error, setError] = useState("");

    const loadWishlist = useCallback(async () => {
        const response = await authFetch(`${BASEURL}/api/wishlist/`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || data.error || "Unable to load your wishlist.");
        }
        setProducts(data);
    }, [BASEURL]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                await loadWishlist();
            } catch (loadError) {
                if (active) {
                    setError(loadError.message);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };
        void Promise.resolve().then(load);
        return () => {
            active = false;
        };
    }, [loadWishlist]);

    const handleRemove = async (productId) => {
        setRemovingProductId(productId);
        setError("");
        try {
            const response = await authFetch(`${BASEURL}/api/wishlist/${productId}/`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Unable to remove this product.");
            }
            setProducts((current) => current.filter((product) => product.id !== productId));
        } catch (removeError) {
            setError(removeError.message);
        } finally {
            setRemovingProductId(null);
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Your account</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Saved products</h1>
                        <p className="mt-2 text-slate-600">Keep your favourites close and come back when you’re ready.</p>
                    </div>
                    <Link to="/" className="text-sm font-semibold text-indigo-600 hover:underline">Continue shopping</Link>
                </div>

                {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

                {loading ? (
                    <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading saved products...</div>
                ) : products.length === 0 ? (
                    <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                        <p className="text-lg font-semibold text-slate-800">Your wishlist is empty</p>
                        <p className="mt-2 text-sm text-slate-500">Save products you like from their product pages.</p>
                        <Link to="/" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
                            Browse products
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {products.map((product) => (
                            <article key={product.id} className="flex flex-col">
                                <div className="flex-1">
                                    <ProductCard product={product} />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(product.id)}
                                    disabled={removingProductId === product.id}
                                    className="mt-3 self-start text-sm font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                    {removingProductId === product.id ? "Removing..." : "Remove from saved"}
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

export default WishlistPage;
