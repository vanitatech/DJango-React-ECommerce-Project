import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";

function ProductDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { addToCart } = useCart();

    useEffect(() => {
        fetch(`${BASEURL}/api/products/${id}/`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to fetch product details');
                }
                return response.json();
            })
            .then((data) => {
                setProduct(data);
                setLoading(false);
            })
            .catch((fetchError) => {
                setError(fetchError.message);
                setLoading(false);
            });
    }, [id, BASEURL]);

    if (loading) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">Loading product...</div>;
    }

    if (error) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-red-600">Error: {error}</div>;
    }

    if (!product) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">No product found.</div>;
    }

    const imageSrc = product.image
        ? product.image.startsWith('http')
            ? product.image
            : `${BASEURL}${product.image}`
        : 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80';

    const handleAddToCart = () => {
        if (!localStorage.getItem('access_token')) {
            alert('Please login to add items to the cart.');
            navigate('/login');
            return;
        }
        addToCart(product.id);
    };

    return (
        <div className="min-h-screen bg-slate-100 py-12">
            <div className="mx-auto max-w-6xl px-6">
                <Link to="/" className="mb-6 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    ← Back to shop
                </Link>

                <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="p-6 md:p-8">
                            <img
                                src={imageSrc}
                                alt={product.name}
                                className="h-full min-h-[360px] w-full rounded-2xl object-cover"
                            />
                        </div>

                        <div className="flex flex-col justify-center p-6 md:p-10">
                            <span className="mb-3 inline-flex w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                                {product.category?.name || 'Featured'}
                            </span>
                            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">{product.name}</h1>
                            <p className="mt-4 text-xl font-bold text-slate-900">${Number(product.price || 0).toFixed(2)}</p>
                            <p className="mt-5 text-base leading-relaxed text-slate-600">{product.description}</p>

                            <div className="mt-8 flex flex-wrap gap-4">
                                <button
                                    onClick={handleAddToCart}
                                    className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700"
                                >
                                    Add to Cart
                                </button>
                                <Link
                                    to="/cart"
                                    className="rounded-xl border border-slate-200 px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                >
                                    View cart
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProductDetails;
