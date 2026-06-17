import api from './axios';

export const getDashboardKpis = () => api.get('/dashboard/kpis');
export const getDashboardCharts = () => api.get('/dashboard/charts');
