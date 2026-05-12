/**
 * 🛰️ jobController.js — Track BullMQ job status
 */

const { postQueue } = require("../utils/queue");

exports.getJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await postQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        const state = await job.getState(); // waiting, active, completed, failed, etc.
        const progress = job.progress;
        const reason = job.failedReason;
        const result = job.returnvalue;

        res.json({
            success: true,
            jobId,
            state,
            progress,
            result,
            error: reason || null
        });
    } catch (err) {
        console.error("❌ Get Job Status Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
