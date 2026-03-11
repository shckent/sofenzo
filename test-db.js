import 'dotenv/config';
import { createDirectus, rest, staticToken, createItem } from '@directus/sdk';

const directus = createDirectus(process.env.VITE_DIRECTUS_URL)
  .with(staticToken(process.env.VITE_DIRECTUS_TOKEN))
  .with(rest());

async function test() {
  try {
    const res = await directus.request(createItem('events', {
      title: "Test API Event",
      date: "2024-10-10",
      time: "15:00",
      description: "Testing API DB insertion",
      color: "#f472b6"
    }));
    console.log("SUCCESS:", res);
  } catch (e) {
    console.log("ERROR:", e.errors || e.message || e);
  }
}
test();
