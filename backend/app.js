
require('dotenv').config({ path: '../.env' });

const express = require("express");

const connectDB = require("./config/database");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();

app.use(express.json());

// Public home route
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Welcome to MED Backend"
    });
});

// Signup and login routes
app.use("/api/auth", authRoutes);

// Example protected route
app.get("/api/profile", authMiddleware, (req, res) => {
    res.status(200).json({
        message: "Authentication successful",
        user: req.user
    });
});

// Start server after database connection
const startServer = async () => {
    if (!process.env.DB_CONNECTION_STRING) {
        console.error("Database connection string is missing");
        process.exit(1);
    }

    await connectDB();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`MED server running on port ${PORT}`);
    });
};

startServer();