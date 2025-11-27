const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { requireAuth } = require("../../utils/auth");

// ✅ PUT /api/user/update
router.put("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email } = req.body;

        // Validation: If name is provided, check length
        if (name && name.trim().length < 2) {
            return res.status(400).json({ error: "Name must be at least 2 characters long." });
        }

        // Ensure at least one field is being updated
        if (!name && !email && !req.body.avatar && !req.body.coverImage) {
            return res.status(400).json({ error: "No changes provided." });
        }

        // Check if email is taken (if changed)
        if (email) {
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ error: "Email is already in use by another account." });
            }
        }

        // Update User
        const updateFields = {};
        if (name) updateFields.name = name.trim();
        if (email) updateFields.email = email.toLowerCase().trim();
        if (req.body.avatar) updateFields.avatar = req.body.avatar;
        if (req.body.coverImage) updateFields.coverImage = req.body.coverImage;

        const updatedUser = await User.findOneAndUpdate(
            { id: userId },
            { $set: updateFields },
            { new: true, select: "-password" } // Return updated doc, exclude password
        );

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json({
            success: true,
            message: "Profile updated successfully!",
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                coverImage: updatedUser.coverImage, // ✅ Include coverImage
                role: updatedUser.role,
                isDemo: false,
            },
        });
    } catch (err) {
        console.error("❌ Update profile error:", err);
        res.status(500).json({ error: "Failed to update profile." });
    }
});

module.exports = router;
