
const User = require("../models/user");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Basic ")) {
            res.set("WWW-Authenticate", 'Basic realm="MED"');

            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // Decode Base64 credentials
        const encodedCredentials = authHeader.split(" ")[1];

        const decodedCredentials = Buffer
            .from(encodedCredentials, "base64")
            .toString("utf8");

        // Split at the first colon
        const separatorIndex = decodedCredentials.indexOf(":");

        if (separatorIndex === -1) {
            return res.status(401).json({
                message: "Invalid credentials format"
            });
        }

        const emailId = decodedCredentials
            .slice(0, separatorIndex)
            .trim()
            .toLowerCase();

        const password = decodedCredentials
            .slice(separatorIndex + 1);

        if (!emailId || !password) {
            return res.status(401).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ emailId });

        if (!user || user.password !== password) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Make authenticated user available to protected routes
        req.user = {
            id: user._id.toString(),
            username: user.username,
            emailId: user.emailId
        };

        next();

    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = authMiddleware;