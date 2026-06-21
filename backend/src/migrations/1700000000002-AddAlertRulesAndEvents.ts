import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertRulesAndEvents1700000000002 implements MigrationInterface {
  name = 'AddAlertRulesAndEvents1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_rules" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "name" varchar NOT NULL,
        "metricName" varchar NOT NULL,
        "comparisonType" varchar NOT NULL,
        "threshold" float NOT NULL,
        "enabled" boolean NOT NULL DEFAULT 1,
        "notificationEmail" varchar NOT NULL DEFAULT '',
        "description" varchar,
        "severity" varchar NOT NULL DEFAULT 'warning',
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_events" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "ruleId" integer NOT NULL,
        "metricName" varchar NOT NULL,
        "value" float NOT NULL,
        "unit" varchar,
        "status" varchar NOT NULL,
        "threshold" float NOT NULL,
        "comparisonType" varchar NOT NULL,
        "previousValue" float,
        "changeRate" float,
        "recoveredAt" datetime,
        "notificationSent" varchar NOT NULL DEFAULT '',
        "triggeredAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_alert_events_ruleId_status"
        ON "alert_events" ("ruleId", "status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_alert_events_ruleId_metricName_triggering"
        ON "alert_events" ("ruleId", "metricName")
        WHERE status = 'triggering'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_events_ruleId_metricName_triggering"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_events_ruleId_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_rules"`);
  }
}
