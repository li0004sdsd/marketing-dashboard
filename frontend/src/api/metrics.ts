import api from './axios';

export const getMetrics = () => api.get('/metrics');
export const getMetricsSummary = () => api.get('/metrics/summary');
