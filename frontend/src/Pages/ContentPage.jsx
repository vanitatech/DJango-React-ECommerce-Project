import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function ContentSection({ section }) {
    const image = section.image_url ? (
        <img
            src={section.image_url}
            alt={section.image_alt || section.heading || ""}
            className="max-h-[28rem] w-full rounded-2xl object-cover"
        />
    ) : null;

    const buttonClass = section.kind === "BANNER"
        ? "mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-indigo-700 hover:bg-indigo-50"
        : "mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700";
    const button = section.button_label && section.button_url ? (
        section.button_url.startsWith("/") ? (
            <Link
                to={section.button_url}
                className={buttonClass}
            >
                {section.button_label}
            </Link>
        ) : (
            <a
                href={section.button_url}
                className={buttonClass}
            >
                {section.button_label}
            </a>
        )
    ) : null;

    if (section.kind === "BANNER") {
        return (
            <section className="overflow-hidden rounded-3xl bg-indigo-700 px-6 py-12 text-white shadow-sm md:px-12 md:py-16">
                {image && <div className="mb-8">{image}</div>}
                {section.heading && (
                    <h2 className="max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
                        {section.heading}
                    </h2>
                )}
                {section.body && (
                    <p className="mt-4 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-indigo-100">
                        {section.body}
                    </p>
                )}
                {button}
            </section>
        );
    }

    if (section.kind === "IMAGE") {
        return (
            <section className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm md:p-8">
                {section.heading && (
                    <h2 className="mb-5 text-2xl font-bold text-slate-900">{section.heading}</h2>
                )}
                {image}
                {section.body && (
                    <p className="mt-5 whitespace-pre-line leading-relaxed text-slate-600">
                        {section.body}
                    </p>
                )}
                {button}
            </section>
        );
    }

    return (
        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-9">
            {section.heading && (
                <h2 className="text-2xl font-bold text-slate-900">{section.heading}</h2>
            )}
            {section.body && (
                <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">
                    {section.body}
                </p>
            )}
            {image && <div className="mt-5">{image}</div>}
            {button}
        </section>
    );
}

function ContentPage() {
    const { slug } = useParams();
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadPage = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(
                    `${BASEURL}/api/content/pages/${encodeURIComponent(slug)}/`,
                );
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "This page could not be found.");
                }
                if (active) setPage(data);
            } catch (loadError) {
                if (active) {
                    setPage(null);
                    setError(loadError.message);
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadPage();
        return () => {
            active = false;
        };
    }, [BASEURL, slug]);

    useEffect(() => {
        if (page) document.title = `${page.title} | VanitaCart`;
        return () => {
            document.title = "VanitaCart | Everyday upgrades";
        };
    }, [page]);

    return (
        <main className="min-h-screen bg-slate-100 px-6 py-12">
            <div className="mx-auto max-w-5xl">
                {loading ? (
                    <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
                        Loading page...
                    </div>
                ) : error ? (
                    <div role="alert" className="rounded-3xl bg-white p-10 text-center shadow-sm">
                        <h1 className="text-2xl font-bold text-slate-900">Page unavailable</h1>
                        <p className="mt-2 text-slate-600">{error}</p>
                        <Link to="/" className="mt-5 inline-flex font-semibold text-indigo-600 hover:underline">
                            Return to the store
                        </Link>
                    </div>
                ) : (
                    <>
                        <header className="mb-8">
                            <h1 className="text-4xl font-black tracking-tight text-slate-900">{page.title}</h1>
                            {page.seo_description && (
                                <p className="mt-3 max-w-3xl text-lg text-slate-600">{page.seo_description}</p>
                            )}
                        </header>
                        <div className="space-y-6">
                            {page.sections.map((section) => (
                                <ContentSection key={`${section.id}-${section.name}`} section={section} />
                            ))}
                        </div>
                        {page.sections.length === 0 && (
                            <p className="rounded-3xl bg-white p-8 text-slate-600 shadow-sm">
                                More information is coming soon.
                            </p>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

export default ContentPage;
