import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/useCart.js';
import { getAccessToken } from '../utils/auth.js';

function ProductCard({ product }) {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const location = useLocation();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!getAccessToken());
    const [addingToCart, setAddingToCart] = useState(false);
    const [cartMessage, setCartMessage] = useState('');
    const [cartError, setCartError] = useState('');
    const imageSrc = product.external_image_url || (product.image
        ? product.image.startsWith('http')
            ? product.image
            : `${BASEURL}${product.image}`
        : 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80');

    useEffect(() => {
        const updateAuthentication = () => setIsLoggedIn(!!getAccessToken());
        window.addEventListener('auth-change', updateAuthentication);
        window.addEventListener('storage', updateAuthentication);
        return () => {
            window.removeEventListener('auth-change', updateAuthentication);
            window.removeEventListener('storage', updateAuthentication);
        };
    }, []);

    const handleAddToCart = async () => {
        if (!getAccessToken()) {
            navigate('/login', { state: { from: location } });
            return;
        }

        setAddingToCart(true);
        setCartMessage('');
        setCartError('');
        try {
            await addToCart(product.id);
            setCartMessage('Added to cart.');
        } catch (error) {
            setCartError(error.message);
        } finally {
            setAddingToCart(false);
        }
    };

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
            <Link to={`/product/${product.id}`} className="block flex-1">
                <div className="relative overflow-hidden">
                    <img
                        src={imageSrc}
                        alt={product.name}
                        className="h-64 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                </div>

                <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                            {product.category?.name || 'General'}
                        </span>
                        <span className={`text-xs font-medium ${product.stock_quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                        </span>
                    </div>

                    <h2 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-700">{product.name}</h2>
                    <p className="line-clamp-2 text-sm text-slate-600">{product.description || 'Premium quality product ready for everyday use.'}</p>
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xl font-bold text-slate-900">${Number(product.price || 0).toFixed(2)}</p>
                        <span className="text-sm font-medium text-indigo-600">
                            {product.review_count ? `★ ${product.average_rating} (${product.review_count})` : 'No reviews'}
                        </span>
                    </div>
                </div>
            </Link>

            <div className="px-4 pb-4">
                <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={product.stock_quantity < 1 || addingToCart}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    {addingToCart
                        ? 'Adding...'
                        : product.stock_quantity < 1
                            ? 'Out of stock'
                            : isLoggedIn
                                ? 'Add to cart'
                                : 'Sign in to add'}
                </button>
                {cartMessage && <p role="status" className="mt-2 text-center text-xs font-medium text-emerald-700">{cartMessage}</p>}
                {cartError && <p role="alert" className="mt-2 text-center text-xs font-medium text-red-600">{cartError}</p>}
            </div>
        </article>
    );
}

export default ProductCard;
