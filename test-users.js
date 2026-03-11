import 'dotenv/config';
import { createDirectus, rest, staticToken, readItems } from '@directus/sdk';

const directus = createDirectus(process.env.VITE_DIRECTUS_URL)
  .with(staticToken(process.env.VITE_DIRECTUS_TOKEN))
  .with(rest());

async function checkUsers() {
    try {
        const users = await directus.request(readItems('users'));
        console.log("Users in DB:", users.length);
        users.forEach(u => {
            console.log(`- ${u.first_name} (@${u.username}), ID: ${u.id}, TG: ${u.telegram_id}`);
        });
    } catch (e) {
        console.error("User list error:", e.message);
    }
}

checkUsers();
