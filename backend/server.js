const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('./app');
const { connectDatabase } = require('./config/database');

async function startServer() {
  await connectDatabase();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Tandem is running on port ${port}`));
}

startServer();