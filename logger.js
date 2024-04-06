const winston = require("winston");

const logger = winston.createLogger({
  level: "error", // Adjust the level as needed
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

module.exports = logger;
