import dotenv from 'dotenv';
import path from 'path';
import { createApp } from './app';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const app = createApp();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`Growith backend listening on port ${port}`);
});
