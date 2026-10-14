require("dotenv").config();

const mongoose = require("mongoose");
const argon2 = require("argon2");

const User = require("../models/User");

const DEMO_PASSWORD = "SecureChat123!";

const demoUsers = [
    {
        username: "alice",
        usernameNormalized: "alice",
        displayName: "Alice",
        email: "alice@securechat.test",
        emailNormalized: "alice@securechat.test",
        emailVerified: true
    },
    {
        username: "bob",
        usernameNormalized: "bob",
        displayName: "Bob",
        email: "bob@securechat.test",
        emailNormalized: "bob@securechat.test",
        emailVerified: true
    }
];

async function seedDemoUsers() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error(
                "Chưa cấu hình MONGODB_URI trong file .env"
            );
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");

        const passwordHash = await argon2.hash(
            DEMO_PASSWORD,
            {
                type: argon2.argon2id
            }
        );

        for (const demoUser of demoUsers) {
            const existingUser = await User.findOne({
                usernameNormalized: demoUser.usernameNormalized
            });

            if (existingUser) {
                existingUser.username = demoUser.username;
                existingUser.usernameNormalized =
                    demoUser.usernameNormalized;
                existingUser.displayName = demoUser.displayName;
                existingUser.email = demoUser.email;
                existingUser.emailNormalized =
                    demoUser.emailNormalized;
                existingUser.emailVerified = true;
                existingUser.passwordHash = passwordHash;

                await existingUser.save();

                console.log(
                    `Updated demo account: ${demoUser.username}`
                );

                continue;
            }

            await User.create({
                ...demoUser,
                passwordHash
            });

            console.log(
                `Created demo account: ${demoUser.username}`
            );
        }

        console.log("Demo accounts are ready!");
    } catch (error) {
        console.error("Seed demo users failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedDemoUsers();