import api from './axios';

export const getRealtimeMonitoring = () => api.get('/monitoring/realtime');
export const getAlerts = () => api.get('/monitoring/alerts');
