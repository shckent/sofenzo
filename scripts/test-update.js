import { createDirectus, rest, staticToken, updateItem } from '@directus/sdk';

const directus = createDirectus('https://directus-production-09cb.up.railway.app')
    .with(staticToken('koe_SmELKmNPz_uIiqfAE_lZSyuKD-cm'))
    .with(rest());

async function test() {
    try {
        const res = await directus.request(updateItem('events', 2, {
            description: "Updated description via node"
        }));
        console.log("SUCCESS UPDATE:", res);
    } catch (e) {
        console.log("ERROR:", e.errors || e.message || e);
    }
}
test();
