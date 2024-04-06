require("dotenv").config();
const jwt_decode = require("jwt-decode");
const jsonwebtoken = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const decodeToken = (token) => {
  try {
    var decoded = jwt_decode(token);
    return decoded;
  } catch (error) {}
};

const verifyToken = (res, token) => {
  try {
    const tokenJson = jsonwebtoken.verify(token, JWT_SECRET);
    return tokenJson;
  } catch (error) {
    return res.status(401).json({
      error: "Not Authorized",
      message: "Invalid username or password",
    });
  }
};

// Centralized error handling function
const handleServerError = (res, err) => {
  res.status(500).json({
    message: `Internal Server Error ${err?.message}`,
  });
};

module.exports = { verifyToken, decodeToken, handleServerError };
