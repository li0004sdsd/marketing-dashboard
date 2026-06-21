import api from './axios';

export interface MetricsQueryParams {
  startDate?: string;
  endDate?: string;
  names?: string[];
  category?: string;
}

export const getMetrics = (params?: MetricsQueryParams) => {
  const config: any = {};
  if (params) {
    config.params = {
      ...params,
      names: params.names?.join(','),
    };
  }
  return api.get('/metrics', config);
};

export const getMetricsSummary = (params?: MetricsQueryParams) => {
  const config: any = {};
  if (params) {
    config.params = {
      ...params,
      names: params.names?.join(','),
    };
  }
  return api.get('/metrics/summary', config);
};
