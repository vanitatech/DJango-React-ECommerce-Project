import { storageKey } from './deployment.js';

export const saveTokens = (tokens) => {
    localStorage.setItem(storageKey("access_token"), tokens.access);
    localStorage.setItem(storageKey("refresh_token"), tokens.refresh);
    window.dispatchEvent(new Event("auth-change"));
};

export const clearTokens = () => {
    localStorage.removeItem(storageKey("access_token"));
    localStorage.removeItem(storageKey("refresh_token"));
    window.dispatchEvent(new Event("auth-change"));
};

export const getAccessToken = () => localStorage.getItem(storageKey("access_token"));

export const authFetch = (url, options = {}) => {
    const token = getAccessToken();
    const headers = { ...(options.headers || {}) };

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(url, { ...options, headers });
};
