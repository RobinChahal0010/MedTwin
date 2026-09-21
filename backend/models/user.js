
const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            minlength: 5,
            maxlength: 20,
            trim: true
        },

        emailId: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 5,
            maxlength: 40,

            validate: {
                validator: function (value) {
                    return validator.isEmail(value);
                },
                message: "Please use a valid email"
            }
        },

        password: {
            type: String,
            required: true,
            minlength: 8
        }
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

module.exports = User;