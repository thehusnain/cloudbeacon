import { app } from './app.js';

const port = Number(process.env.PORT ?? 5000);

app.listen(port, () => {
  console.log(`Cloud Beacon backend listening on port ${port}`);
});
