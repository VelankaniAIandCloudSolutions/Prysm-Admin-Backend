require("dotenv").config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, //
  server: process.env.SERVER,
  database: process.env.DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instancename: process.env.INSTANCE_NAME,
  },
  port: 1433,
};

module.exports = config;
