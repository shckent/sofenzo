import { createDirectus, rest, staticToken, createItem } from '@directus/sdk';

const directus = createDirectus('https://directus-production-09cb.up.railway.app')
    .with(staticToken('koe_SmELKmNPz_uIiqfAE_lZSyuKD-cm'))
    .with(rest());

async function test() {
  try {
    const res = await directus.request(createItem('events', {
      title: "Test Relation",
      date: "2024-10-10",
      time: "15:00",
      description: "Testing API DB insertion",
      color: "#f472b6",
      user_id: 12345 // using the mock local ID
    }));
    console.log("SUCCESS:", res);
  } catch(e) {
    console.log("ERROR:", e.errors || e.message || e);
  }
}
test();
