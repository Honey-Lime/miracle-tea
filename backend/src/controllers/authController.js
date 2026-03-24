const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register new user or login if exists
exports.registerOrLogin = async (req, res) => {
  const { phone, password, name } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ phone });
    if (user) {
      // Login
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
    } else {
      // Register
      if (!name) {
        return res
          .status(400)
          .json({ message: "Name is required for registration" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        name,
        phone,
        password: hashedPassword,
      });
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        total: user.total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
