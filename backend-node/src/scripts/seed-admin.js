/**
 * seed-admin.js
 * Run once to create the initial admin user in MongoDB.
 *
 * Usage: node src/scripts/seed-admin.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");

const ADMIN = {
  name:            "Sohail Shabbir",
  email:           "shabbirsohail33@gmail.com",
  password:        "Sohail123#",
  role:            "admin",
  specialty:       "Medical Research",
  status:          "active",
  isEmailVerified: true,
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/medresearch");
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ email: ADMIN.email });

    if (existing) {
      console.log(`ℹ️  Admin already exists: ${ADMIN.email}`);
      console.log(`   Role: ${existing.role} | Status: ${existing.status}`);

      // Ensure status is correct even if schema changed
      if (!existing.isEmailVerified || existing.status !== "active") {
        existing.isEmailVerified = true;
        existing.status          = "active";
        await existing.save();
        console.log("✅ Admin account repaired (set verified + active)");
      }
    } else {
      const admin = new User(ADMIN);
      await admin.save();
      console.log("✅ Admin user created successfully!");
      console.log(`   📧  Email: ${ADMIN.email}`);
      console.log(`   🔑  Password: ${ADMIN.password}`);
      console.log(`   👑  Role: admin`);
    }

    console.log("\n🚀 You can now log in at http://localhost:5173/login\n");
  } catch (err) {
    console.error("❌ Seed error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
