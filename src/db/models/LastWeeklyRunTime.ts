import { DataTypes, Model } from 'sequelize';
import { db } from '../db';
import cronParser from 'cron-parser';
import { TIMEZONE } from '~/constants';

export class LastWeeklyRunTime extends Model {
  declare value: Date;
}
LastWeeklyRunTime.init(
  {
    value: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    paused: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize: db,
    modelName: 'last_weekly_run_time',
    freezeTableName: true,
    timestamps: false,
  }
);

export async function seed() {
  // Get the most recent scheduled Monday 12:01am occurrence
  const now = new Date();
  const cronExpression = cronParser.parse('1 0 * * 1', {
    tz: TIMEZONE,
    currentDate: now,
  });
  const lastMondayRunTime = cronExpression.prev().toDate();

  await LastWeeklyRunTime.create({
    value: lastMondayRunTime,
    paused: false,
  });
  console.log('LastWeeklyRunTime seeded!');
}

LastWeeklyRunTime.sync();
