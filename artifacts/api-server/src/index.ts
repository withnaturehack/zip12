import cluster from "cluster";
import os from "os";
import app from "./app.js";
import { autoSeed } from "./autoSeed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const numCPUs = os.cpus().length;

if (cluster.isPrimary && numCPUs > 1) {
  console.log(`[Cluster] Primary ${process.pid} starting ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.warn(`[Cluster] Worker ${worker.process.pid} died (${signal || code}). Restarting…`);
    cluster.fork();
  });

  // Only the primary runs autoSeed
  (async () => {
    await autoSeed();
  })();
} else {
  app.listen(port, () => {
    console.log(`[Worker ${process.pid}] Listening on port ${port}`);
  });
}
