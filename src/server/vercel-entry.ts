import * as dotenv from 'dotenv';
import { createGimmoApiApp } from './create-app.ts';

dotenv.config();

const app = createGimmoApiApp({
  serverlessMode: true,
});

export default app;
