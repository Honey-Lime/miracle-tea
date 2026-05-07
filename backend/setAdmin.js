const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./src/models/User");

async function setAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminEmail = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",")[0].trim().toLowerCase()
      : "";
    const user = await User.findOne({ email: adminEmail });

    if (!user) {
      console.log(`User with email ${adminEmail} not found`);
      mongoose.disconnect();
      return;
    }

    if (user.isAdmin) {
      console.log(`User ${user.name} is already an admin`);
    } else {
      user.isAdmin = true;
      await user.save();
      console.log(`User ${user.name} (${user.email}) is now an admin!`);
    }

    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

setAdmin();
