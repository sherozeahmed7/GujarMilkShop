import app from './app';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { startSyncWorker } from './workers/syncWorker';
import { startDownstreamSyncWorker } from './workers/downstreamSyncWorker';

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database and start Express server
async function startServer() {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 Express server is running on port ${PORT}`);
    
    // Start background sync workers
    startSyncWorker();
    startDownstreamSyncWorker();
  });
  
  return server;
}

const serverPromise = startServer();

export default serverPromise;
