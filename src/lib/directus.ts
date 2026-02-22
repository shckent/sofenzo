import { createDirectus, rest, staticToken } from '@directus/sdk';

const url = 'https://directus-production-09cb.up.railway.app';
const token = 'koe_SmELKmNPz_uIiqfAE_lZSyuKD-cm';

if (!url || !token) {
    console.error('CRITICAL: Directus URL or Token is missing!');
}

export const directus = createDirectus(url)
    .with(staticToken(token))
    .with(rest());

export default directus;
