import axios from 'axios';
import { clearAllOfflineCaches } from '../utils/offlineStore';

let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// Ensure the baseUrl always ends with /api to prevent Vercel 404 routing errors
if (baseUrl && !baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
}

const api = axios.create({
    baseURL: baseUrl,
    headers: { 'Content-Type': 'application/json' },
});

// Request Interceptor: Attach bearer token to headers
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('tailor_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor: Handle 401 Unauthorized globally
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const isActionPasswordError = error.response?.data?.error?.toLowerCase().includes('password');
        if (error.response && error.response.status === 401 && !isActionPasswordError) {
            localStorage.removeItem('tailor_auth');
            localStorage.removeItem('tailor_token');
            localStorage.removeItem('lm_tailor_drafts');
            localStorage.removeItem('newOrderDraft');
            sessionStorage.clear();
            await clearAllOfflineCaches();
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
