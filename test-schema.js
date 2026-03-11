import 'dotenv/config';
import axios from 'axios';

const url = process.env.VITE_DIRECTUS_URL;
const token = process.env.VITE_DIRECTUS_TOKEN;

async function checkSchema() {
    try {
        const res = await axios.get(`${url}/collections`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const relevant = res.data.data.filter(c => ['users', 'events', 'tasks'].includes(c.collection));

        for (const coll of relevant) {
            console.log(`\nCollection: ${coll.collection}`);
            const fieldsRes = await axios.get(`${url}/fields/${coll.collection}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fieldsRes.data.data.forEach(f => {
                console.log(`- ${f.field} (${f.type})`);
            });
        }
    } catch (e) {
        console.error("Schema error:", e.response?.data || e.message);
    }
}

checkSchema();
