import {useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import { API_BASE } from '../utils/deployment.js';

function Signup() {
    const BASE = API_BASE;
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState({
        username: '',
        password: '',
        email: searchParams.get('email') || '',
        password2: '',
    });
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({...form, [e.target.name]: e.target.value});
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');
        try {
            const response = await fetch(`${BASE}/api/register/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(form),
            });
            const data = await response.json();
            if (response.ok) {
                setMsg('Account created successfully! Redirecting to login...');
                setTimeout(() => {
                    navigate('/login'); // Redirect to login page after successful signup
                }, 1200);
            } else {
                setMsg(data.username || data.password || JSON.stringify(data));
            }
        } catch (error) {
            console.error(error);
            setMsg('Signup failed. Please try again later.');
        }

    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white p-6 rounded shadow">
                <h2 className="text-2xl font-bold mb-4">Signup</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        name="username"
                        onChange={handleChange}
                        value={form.username}
                        placeholder="Username"
                        className="w-full p-2 border rounded"
                    />
                    <input
                        name="email"
                        type="email"
                        onChange={handleChange}
                        value={form.email}
                        placeholder="Email"
                        className="w-full p-2 border rounded"
                    />
                    <input
                        name="password"
                        type="password"
                        onChange={handleChange}
                        value={form.password}
                        placeholder="Password"
                        className="w-full p-2 border rounded"
                    />
                    <input name="password2"
                        type="password"
                        onChange={handleChange}
                        value={form.password2}
                        placeholder="Confirm Password"
                        className="w-full p-2 border rounded"
                    />
                    <button className="w-full bg-blue-600 text-white py-2 rounded" type="submit">Create Account</button>
                    </form>
                {msg && <p className="mt-3 text-sm text-red-500">{msg}</p>}
            </div>
        </div>
    );
}

export default Signup;
