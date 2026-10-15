import { openDb } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const app = createApp(openDb());
app.listen(port, () => console.log(`asset-sale: http://localhost:${port}`));
