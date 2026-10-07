import { useEffect, useState } from "react";
import { authFetch } from "../utils/auth.js";
import { API_BASE } from "../utils/deployment.js";

const emptyProfile = { username: "", email: "", phone: "", address: "" };

function ProfilePage() {
    const BASEURL = API_BASE;
    const [profile, setProfile] = useState(emptyProfile);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        const loadProfile = async () => {
            try {
                const response = await authFetch(`${BASEURL}/api/profile/`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || "Unable to load your profile.");
                }
                if (active) {
                    setProfile(data);
                }
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

        void Promise.resolve().then(loadProfile);
        return () => {
            active = false;
        };
    }, [BASEURL]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setProfile((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const response = await authFetch(`${BASEURL}/api/profile/`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: profile.email,
                    phone: profile.phone,
                    address: profile.address,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(Object.values(data).flat().join(" ") || "Unable to save your profile.");
            }
            setProfile(data);
            setMessage("Your profile has been saved.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Your account</p>
                    <h1 className="mt-2 text-3xl font-black text-slate-900">Profile settings</h1>
                    <p className="mt-2 text-slate-600">Keep your contact and delivery details up to date.</p>
                </div>

                <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                    {loading ? (
                        <p className="text-slate-500">Loading your profile...</p>
                    ) : error && !profile.username ? (
                        <p role="alert" className="text-red-600">{error}</p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="profile-username" className="mb-2 block text-sm font-medium text-slate-700">Username</label>
                                <input
                                    id="profile-username"
                                    value={profile.username}
                                    readOnly
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="profile-email" className="mb-2 block text-sm font-medium text-slate-700">Email address</label>
                                <input
                                    id="profile-email"
                                    name="email"
                                    type="email"
                                    value={profile.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="profile-phone" className="mb-2 block text-sm font-medium text-slate-700">Phone number</label>
                                <input
                                    id="profile-phone"
                                    name="phone"
                                    type="tel"
                                    maxLength={15}
                                    value={profile.phone}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="profile-address" className="mb-2 block text-sm font-medium text-slate-700">Delivery address</label>
                                <textarea
                                    id="profile-address"
                                    name="address"
                                    rows={4}
                                    value={profile.address}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            >
                                {saving ? "Saving..." : "Save profile"}
                            </button>
                            {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
                            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                        </form>
                    )}
                </section>
            </div>
        </main>
    );
}

export default ProfilePage;
