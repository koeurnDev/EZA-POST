const express = require("express");
const router = express.Router();
const { exec } = require("child_process");

router.get("/python-check", (req, res) => {
    const isWin = process.platform === "win32";
    const pythonCmd = isWin ? "python" : "python3";

    // Check Version and CV2
    const cmd = `${pythonCmd} -c "import sys; print('Python ' + sys.version); import cv2; print('OpenCV ' + cv2.__version__)"`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            return res.json({
                success: false,
                error: error.message,
                stderr: stderr
            });
        }
        res.json({
            success: true,
            output: stdout,
            debug: { isWin, pythonCmd }
        });
    });
});

module.exports = router;
