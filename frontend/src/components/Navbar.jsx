import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/useCart.js";
import { clearTokens, getAccessToken } from "../utils/auth.js";

function Navbar() {
    const { cartItems, clearCart } = useCart();
    const navigate = useNavigate();
    const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!getAccessToken());

    useEffect(() => {
        const updateAuthentication = () => setIsLoggedIn(!!getAccessToken());
        window.addEventListener("auth-change", updateAuthentication);
        window.addEventListener("storage", updateAuthentication);
        return () => {
            window.removeEventListener("auth-change", updateAuthentication);
            window.removeEventListener("storage", updateAuthentication);
        };
    }, []);

    const handleLogout = () => {
        clearTokens();
        clearCart();
        navigate('/login');
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <Link to="/" className="text-2xl font-black tracking-tight text-slate-900">
                    🛍 VanitaCart
                </Link>

                <div className="flex items-center gap-5 text-sm font-medium text-slate-700">
                    {!isLoggedIn ? (
                        <>
                            <Link to="/login" className="hover:text-slate-900">Login</Link>
                            <Link to="/signup" className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-700">
                                Sign up
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to="/profile" className="hover:text-slate-900">Profile</Link>
                            <Link to="/orders" className="hover:text-slate-900">Orders</Link>
                            <button onClick={handleLogout} className="hover:text-slate-900">Logout</button>
                        </>
                    )}

                    <Link to="/cart" className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300">
                        <span>Cart</span>
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                            {cartCount}
                        </span>
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
