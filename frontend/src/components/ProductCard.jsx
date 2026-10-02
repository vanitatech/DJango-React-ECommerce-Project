import { Link } from 'react-router-dom';

function ProductCard({ product }) {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const imageSrc = product.image
        ? `${BASEURL}${product.image}`
        : 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80';

    return (
        <Link to={`/product/${product.id}`} className="group block h-full">
            <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
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
                        <span className="text-xs font-medium text-emerald-600">In stock</span>
                    </div>

                    <h2 className="text-lg font-semibold text-slate-800">{product.name}</h2>
                    <p className="line-clamp-2 text-sm text-slate-600">{product.description || 'Premium quality product ready for everyday use.'}</p>
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xl font-bold text-slate-900">${Number(product.price || 0).toFixed(2)}</p>
                        <span className="text-sm font-medium text-indigo-600">View item →</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default ProductCard;
