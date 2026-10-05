import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

const hasAccessToken = () => !!localStorage.getItem("access_token");

export default function PrivateRouter({redirectTo = "/login"}) {
    const [isAuthenticated, setIsAuthenticated] = useState(hasAccessToken);

    useEffect(() => {
        const updateAuthentication = () => setIsAuthenticated(hasAccessToken());
        window.addEventListener("auth-change", updateAuthentication);
        window.addEventListener("storage", updateAuthentication);
        return () => {
            window.removeEventListener("auth-change", updateAuthentication);
            window.removeEventListener("storage", updateAuthentication);
        };
    }, []);

    return isAuthenticated ? <Outlet /> : <Navigate to={redirectTo} replace />;
}