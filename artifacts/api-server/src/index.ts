import cluster from "cluster";
import { cpus } from "os";
import app from "./app.js";
import { autoSeed } from "./autoSeed.js";

const PORT = Number(process.env.PORT) || 8080;
const WORKERS = process.env.NODE_ENV === "development" ? cpus().length : 4;

if (cluster.isPrimary) {
  console.log(`[Cluster] Primary ${process.pid} starting ${WORKERS} workers`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on("exit", (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  app.listen(PORT, () => {
    console.log(`[Worker ${process.pid}] Listening on port ${PORT}`);
  });
  autoSeed().catch(console.error);
}
