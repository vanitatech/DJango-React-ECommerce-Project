import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveTokens } from '../utils/auth';

function Login() {
    const BASE = import.meta.env.VITE_DJANGO_BASE_URL;
    const [form, setForm] = useState({ username: '', password: '' });
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');
        try {
            const response = await fetch(`${BASE}/api/token/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(form),
            });
            const data = await response.json();
            if (response.ok) {
                saveTokens(data);
                setMsg('Login Successful! Redirecting...');
                setTimeout(() => {
                    navigate('/'); // Redirect to home page after successful login
                }, 800);
            }
            else {
                setMsg(data.detail || 'Login failed. Please try again.');
            }
        } catch (error) {
            setMsg('An error occurred. Please try again later.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white p-6">
                <h2 className="text-2xl font-bold mb-4">Login</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        name="username"
                        onChange={handleChange}
                        value={form.username}
                        placeholder="Username"
                        className="w-full p-2 border.rounded"
                    />
                    <input
                        name="password"
                        type="password"
                        onChange={handleChange}
                        value={form.password}
                        placeholder="Password"
                        required
                        className="w-full p-2 border.rounded"
                    />
                    <button className="w-full bg-blue-600 text-white py-2 rounded" type="submit">Login</button>
                </form>
                {msg && <p className="mt-3 text-sm text-red-500">{msg}</p>}
                <div className="mt-4 text-sm">
                    Don't have an account?{" "}
                    <a href="/signup" className="text-blue-600 hover:underline">Sign up</a>
                </div>
            </div>
        </div>
    )
};

export default Login;