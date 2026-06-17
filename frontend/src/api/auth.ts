import api from './axios';

export const loginApi = (username: string, password: string) =>
  api.post('/auth/login', { username, password });

export const registerApi = (username: string, password: string, role: string) =>
  api.post('/auth/register', { username, password, role });
