export function apiBase(frontendBase, configuredBase) {
    return (configuredBase ?? frontendBase).replace(/\/$/, '');
}

export const API_BASE = apiBase(
    import.meta.env?.BASE_URL ?? '/',
    import.meta.env?.VITE_DJANGO_BASE_URL,
);

export function storageKey(key, base = import.meta.env?.BASE_URL ?? '/') {
    return base === '/' ? key : `vanitacart:${base}:${key}`;
}

export function mediaUrl(value, backendBase = API_BASE, origin = window.location.origin) {
    return new URL(value, new URL(backendBase || '/', origin)).href;
}
