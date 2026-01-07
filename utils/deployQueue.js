/**
 * ChainForge — In-process Deployment Queue
 *
 * Guarantees:
 * - Deterministic execution (nonce-safe, concurrency=1)
 * - Auditable job lifecycle
 * - Free-tier compatible (no Redis / DB required)
 *
 * Design:
 * - Queue is INTERNAL infrastructure
 * - API consumers receive FINAL results (not queue mechanics)
 * - Jobs remain inspectable for debugging & audit
 */

const { randomUUID } = require("crypto");

class DeployQueue {
  constructor({ concurrency = 1 } = {}) {
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.running = 0;
    this.queue = [];
    this.jobs = new Map();
  }

  /* ------------------------------------------------------------------
     Job lifecycle
  ------------------------------------------------------------------- */

  createJob({ handler, input }) {
  console.log("[QUEUE] createJob called", {
    handlerType: typeof handler,
    hasInput: !!input,
  });

  if (typeof handler !== "function") {
    throw new Error("Job handler must be a function");
  }

    const id = randomUUID();

    const job = {
      id,
      status: "queued", // queued | running | succeeded | failed
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      
      handler,        //  STORE THE HANDLER
      input,
      
      result: null,
      error: null,
    };


    this.jobs.set(id, job);
    this.queue.push(id);
    this._drain();

    return job;
  }

  getJob(id) {
    return this.jobs.get(id) || null;
  }

  listJobs({ limit = 50 } = {}) {
    return Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
  }

  /* ------------------------------------------------------------------
     Await completion (KEY MISSING PIECE)
  ------------------------------------------------------------------- */

  waitForJob(jobId, { timeoutMs = 180000, pollMs = 750 } = {}) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const tick = () => {
        const job = this.getJob(jobId);
        if (!job) {
          return reject(new Error("Deployment job not found"));
        }

        if (job.status === "succeeded") {
          return resolve(job);
        }

        if (job.status === "failed") {
          return reject(
            new Error(job.error?.message || "Deployment failed")
          );
        }

        if (Date.now() - startedAt > timeoutMs) {
          return reject(
            new Error(
              "Deployment timed out. Check Deployment History for status."
            )
          );
        }

        setTimeout(tick, pollMs);
      };

      tick();
    });
  }

  /* ------------------------------------------------------------------
     Internal execution loop
  ------------------------------------------------------------------- */

  async _drain() {
    if (this.running >= this.concurrency) return;

    const nextId = this.queue.shift();
    if (!nextId) return;

    const job = this.jobs.get(nextId);
    if (!job) return;

    this.running += 1;
    job.status = "running";
    job.startedAt = new Date().toISOString();

    try {
      job.result = await job.handler(job.input);
      job.status = "succeeded";
    } catch (err) {
      job.status = "failed";
      job.error = {
        message: err?.message || "Unknown error",
      };
    } finally {
      job.finishedAt = new Date().toISOString();
      this.running -= 1;
      setImmediate(() => this._drain());
    }
  }
}

module.exports = new DeployQueue({ concurrency: 1 });
