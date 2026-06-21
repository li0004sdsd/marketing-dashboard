import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineInit1700000000000 implements MigrationInterface {
  name = 'BaselineInit1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "username" varchar NOT NULL,
        "passwordHash" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'viewer',
        "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_sources" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "name" varchar NOT NULL,
        "type" varchar NOT NULL,
        "connectionString" varchar,
        "status" varchar NOT NULL DEFAULT 'active',
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "metrics" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "name" varchar NOT NULL,
        "value" float NOT NULL,
        "unit" varchar,
        "category" varchar NOT NULL,
        "dataSourceId" integer,
        "timestamp" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "monitor_snapshots" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "metricName" varchar NOT NULL,
        "value" float NOT NULL,
        "status" varchar NOT NULL,
        "unit" varchar,
        "batchId" varchar NOT NULL,
        "recordedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monitor_snapshots_batchId_metricName"
        ON "monitor_snapshots" ("batchId", "metricName")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dashboard_layouts" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "userId" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "layoutConfig" json NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT 0,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dashboard_layouts_userId_name"
        ON "dashboard_layouts" ("userId", "name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dashboard_layouts_userId_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dashboard_layouts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monitor_snapshots_batchId_metricName"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "monitor_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "data_sources"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
