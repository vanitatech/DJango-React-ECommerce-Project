export function basePath(value = '/') {
    if (!/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(value)) {
        throw new Error('VITE_BASE_PATH must be an absolute path containing only letters, digits, hyphens, underscores and slashes');
    }
    return value.endsWith('/') ? value : value + '/';
}
