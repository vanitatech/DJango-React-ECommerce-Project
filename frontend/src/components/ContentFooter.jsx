import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function ContentFooter() {
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const [pages, setPages] = useState([]);

    useEffect(() => {
        let active = true;
        const loadPages = async () => {
            try {
                const response = await fetch(`${BASEURL}/api/content/pages/`);
                if (!response.ok) {
                    throw new Error("Unable to load published pages.");
                }
                const data = await response.json();
                if (active) setPages(data);
            } catch (error) {
                console.error(error);
            }
        };

        void loadPages();
        return () => {
            active = false;
        };
    }, [BASEURL]);

    return (
        <footer className="border-t border-slate-200 bg-white px-6 py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>© {new Date().getFullYear()} VanitaCart</p>
                {pages.length > 0 && (
                    <nav aria-label="Store information" className="flex flex-wrap gap-x-5 gap-y-2">
                        {pages.map((page) => (
                            <Link
                                key={page.slug}
                                to={`/pages/${page.slug}`}
                                className="font-medium text-slate-600 hover:text-indigo-600"
                            >
                                {page.title}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>
        </footer>
    );
}

export default ContentFooter;
