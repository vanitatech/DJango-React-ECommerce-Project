import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";

function ProductList() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get("q") || "";
    const selectedCategory = searchParams.get("category") || "all";
    const sortOptions = ["newest", "lowToHigh", "highToLow", "name"];
    const requestedSort = searchParams.get("sort");
    const sortBy = sortOptions.includes(requestedSort) ? requestedSort : "newest";
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL;

    const updateFilter = (name, value, replace = false) => {
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            if (value) {
                nextParams.set(name, value);
            } else {
                nextParams.delete(name);
            }
            return nextParams;
        }, { replace });
    };

    const clearFilters = () => {
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            ["q", "category", "sort"].forEach((filter) => nextParams.delete(filter));
            return nextParams;
        });
    };

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch(`${BASE_URL}/api/categories/`);
                if (!response.ok) {
                    throw new Error("Failed to fetch categories");
                }
                const data = await response.json();
                setCategories(data);
            } catch (categoryError) {
                console.error(categoryError);
            }
        };

        const fetchProducts = async () => {
            try {
                const response = await fetch(`${BASE_URL}/api/products/`);
                if (!response.ok) {
                    throw new Error("Failed to fetch products");
                }
                const data = await response.json();
                setProducts(data);
            } catch (requestError) {
                setError(requestError.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
        fetchProducts();
    }, [BASE_URL]);

    const filteredProducts = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const sorters = {
            newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
            lowToHigh: (a, b) => Number(a.price) - Number(b.price),
            highToLow: (a, b) => Number(b.price) - Number(a.price),
            name: (a, b) => a.name.localeCompare(b.name),
        };

        return [...products]
            .filter((product) => {
                const categoryMatch = selectedCategory === "all" || product.category?.slug === selectedCategory;
                const queryMatch =
                    !normalizedSearch ||
                    product.name.toLowerCase().includes(normalizedSearch) ||
                    product.description.toLowerCase().includes(normalizedSearch);

                return categoryMatch && queryMatch;
            })
            .sort(sorters[sortBy] || sorters.newest);
    }, [products, searchTerm, selectedCategory, sortBy]);

    const reviewSummary = useMemo(() => {
        const reviewedProducts = products.filter((product) => product.review_count > 0);
        const reviewCount = reviewedProducts.reduce((count, product) => count + product.review_count, 0);
        const ratingTotal = reviewedProducts.reduce(
            (total, product) => total + product.average_rating * product.review_count,
            0
        );
        return {
            count: reviewCount,
            rating: reviewCount ? (ratingTotal / reviewCount).toFixed(1) : "New",
        };
    }, [products]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">
                Loading products...
            </div>
        );
    }

    if (error) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-red-600">Error: {error}</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800">
            <section className="bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 text-white">
                <div className="mx-auto max-w-7xl px-6 py-16">
                    <div className="grid gap-8 md:grid-cols-2 md:items-center">
                        <div>
                            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium">
                                New collection
                            </span>
                            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">
                                Built for everyday upgrades.
                            </h1>
                            <p className="mt-4 max-w-lg text-lg text-indigo-100">
                                Discover premium essentials, smart tools, and trending favourites designed to make modern living easier.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-4 text-sm text-indigo-100">
                                <span>Free shipping over $50</span>
                                <span>Secure checkout</span>
                                <span>Easy returns</span>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Products</p>
                                    <p className="mt-2 text-3xl font-bold">{products.length}</p>
                                </div>
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Deals</p>
                                    <p className="mt-2 text-3xl font-bold">24/7</p>
                                </div>
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Rating</p>
                                    <p className="mt-2 text-3xl font-bold">{reviewSummary.rating}</p>
                                    <p className="mt-1 text-xs text-indigo-200">
                                        {reviewSummary.count ? `${reviewSummary.count} customer reviews` : "First reviews welcome"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-7xl px-6 py-10">
                <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 flex-col gap-3 md:flex-row">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => updateFilter("q", event.target.value, true)}
                            placeholder="Search products..."
                            aria-label="Search products"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white md:max-w-xs"
                        />

                        <select
                            value={selectedCategory}
                            onChange={(event) => updateFilter("category", event.target.value === "all" ? "" : event.target.value)}
                            aria-label="Filter by category"
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
                        >
                            <option value="all">All categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.slug}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <select
                        value={sortBy}
                        onChange={(event) => updateFilter("sort", event.target.value === "newest" ? "" : event.target.value)}
                        aria-label="Sort products"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
                    >
                        <option value="newest">Newest arrivals</option>
                        <option value="lowToHigh">Price: Low to high</option>
                        <option value="highToLow">Price: High to low</option>
                        <option value="name">Name</option>
                    </select>
                </div>

                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Featured items</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">{filteredProducts.length} results</span>
                        {(searchTerm || selectedCategory !== "all" || sortBy !== "newest") && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                        No products match your search. Try another term or category.
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProductList;
