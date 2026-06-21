import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH || 'marketing_dashboard.db',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
