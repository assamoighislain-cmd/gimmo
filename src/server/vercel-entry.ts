import { createGimmoApiApp } from './create-app.ts';

const app = createGimmoApiApp({
  serverlessMode: true,
});

export default app;
