import { postAnnouncements } from '~/helpers';
import { Announcement } from '~/db/models/Announcement';
import { client } from '~/index';

async function update() {
  // Find all announcements
  const announcements = await Announcement.findAll();

  for (const announcement of announcements) {
    if (announcement.weeks === undefined || announcement.weeks === null) {
      continue;
    }
    if (announcement.weeks <= 0) {
      await announcement.destroy();
    } else {
      announcement.weeks -= 1;
      await announcement.save();
    }
  }
}

async function post() {
  if (!client.isReady()) {
    console.warn('Client is not ready yet. Delaying message send.');
    return;
  }

  const announcements = await Announcement.findAll();
  postAnnouncements(announcements);
}

const order = 9999; // announcements should always be last

export { update, post, order };
