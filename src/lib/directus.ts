import { createDirectus, rest, staticToken } from '@directus/sdk';

const url = import.meta.env.VITE_DIRECTUS_URL;
const token = import.meta.env.VITE_DIRECTUS_TOKEN;

if (!url || !token) {
    console.warn('Directus URL or Token is missing in environment variables');
}

export const directus = createDirectus(url)
    .with(staticToken(token))
    .with(rest());

export default directus;
