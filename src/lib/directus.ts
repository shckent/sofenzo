import { createDirectus, rest } from '@directus/sdk';

// Use relative path so all requests go through the Express proxy
// which injects the Auth token and avoids CORS errors.
const url = '/api/directus';

export const directus = createDirectus(url)
    .with(rest());

export default directus;
