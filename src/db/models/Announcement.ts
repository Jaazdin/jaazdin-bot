import { DataTypes, Model } from 'sequelize';
import { CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { db } from '../db';

interface AnnouncementAttributes {
  id?: number;
  name: string;
  message: string;
  weeks?: number; // Weeks to repeat if repeatable
  createdAt?: Date;
  updatedAt?: Date;
}

type AnnouncementCreationAttributes = Omit<AnnouncementAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class Announcement
  extends Model<AnnouncementAttributes, AnnouncementCreationAttributes>
  implements AnnouncementAttributes
{
  declare id?: number;
  declare name: string;
  declare message: string;
  declare weeks?: number;
  @CreatedAt declare createdAt?: Date;
  @UpdatedAt declare updatedAt?: Date;
}

// --- Initialize Model ---
Announcement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    weeks: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
  }
);

async function seed() {
  //await Timer.sync({ force: true });
  const announcementsData = (await import('~/seeds/announcements.json')).default;
  try {
    for (const announcement of announcementsData) {
      await Announcement.create({
        name: announcement.name,
        message: announcement.message,
        weeks: announcement.weeks,
      });
    }
    console.log('Announcements seeded!');
  } catch (error) {
    console.error('Could not seed announcements:', error);
  }
}

export { seed };

Announcement.sync();
