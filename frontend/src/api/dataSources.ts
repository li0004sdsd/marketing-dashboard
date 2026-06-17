import api from './axios';

export const getDataSources = () => api.get('/data-sources');
export const createDataSource = (data: any) => api.post('/data-sources', data);
export const updateDataSource = (id: number, data: any) => api.put(`/data-sources/${id}`, data);
export const deleteDataSource = (id: number) => api.delete(`/data-sources/${id}`);
