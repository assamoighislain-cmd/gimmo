import * as dotenv from 'dotenv';
import { createGimmoApiApp } from '../src/server/create-app.ts';

dotenv.config();

const app = createGimmoApiApp({
  serverlessMode: true,
});

export default app;
