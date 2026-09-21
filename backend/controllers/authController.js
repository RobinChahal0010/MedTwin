
const User = require("../models/user");

// SIGNUP
const signup = async (req, res) => {
    try {
        const { username, emailId, password } = req.body;

        if (!username || !emailId || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const normalizedEmail = emailId.trim().toLowerCase();

        const existingUser = await User.findOne({
            emailId: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const user = await User.create({
            username,
            emailId: normalizedEmail,
            password
        });

        return res.status(201).json({
            message: "Signup successful",
            user: {
                id: user._id,
                username: user.username,
                emailId: user.emailId
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message
            });
        }

        console.error("Signup error:", error.message);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

// LOGIN
const login = async (req, res) => {
    try {
        const { emailId, password } = req.body;

        if (!emailId || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            emailId: emailId.trim().toLowerCase()
        });

        if (!user || user.password !== password) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                username: user.username,
                emailId: user.emailId
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = {
    signup,
    login
};