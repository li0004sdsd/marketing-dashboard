import api from './axios';

export interface DashboardQueryParams {
  days?: number;
}

export const getDashboardKpis = (params?: DashboardQueryParams) => {
  const config = params ? { params } : undefined;
  return api.get('/dashboard/kpis', config);
};

export const getDashboardCharts = (params?: DashboardQueryParams) => {
  const config = params ? { params } : undefined;
  return api.get('/dashboard/charts', config);
};
