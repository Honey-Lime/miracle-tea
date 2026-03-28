const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./src/models/User");

async function setAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminPhone = "79202115108";
    const user = await User.findOne({ phone: adminPhone });

    if (!user) {
      console.log(`User with phone ${adminPhone} not found`);
      mongoose.disconnect();
      return;
    }

    if (user.isAdmin) {
      console.log(`User ${user.name} is already an admin`);
    } else {
      user.isAdmin = true;
      await user.save();
      console.log(`User ${user.name} (${user.phone}) is now an admin!`);
    }

    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

setAdmin();
