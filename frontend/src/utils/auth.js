export const saveToken = (token) => {
    localStorage.setItem('authToken', tokens.access);
    localStorage.setItem('refreshToken', tokens.refresh);
    }

export const clearToken = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
};

export const getAccessToken = () => 
    localStorage.getItem("access_Token");


export const authFetch =  (url, options = {}) => {
    const token = getAccessToken();
    const headers = options.headers ? {...options.headers} : {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        return fetch(url, {...options, headers});
    }


};
