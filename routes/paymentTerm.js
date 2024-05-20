require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");

const {
  verifyToken,
  decodeToken,
  handleServerError,
} = require("../Helper/helper");

router.get("/get-payment-term", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);

      const result = await pool
        .request()
        .input("Action", sql.NVarChar(10), "GET")
        .execute("sp_Manage_Payment_Terms");

      return res.status(200).json(result.recordset);
    }
  } catch (err) {
    console.error("Error fetching payment terms:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/payment-term", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];

    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);

      const { is_active, payment_type, percentage } = req.body;

      const result = await pool
        .request()
        .input("Action", sql.NVarChar(10), "INSERT")
        .input("is_active", sql.Bit, is_active)
        .input("payment_type", sql.NVarChar(50), payment_type)
        .input("percentage", sql.Decimal(5, 2), percentage)
        .execute("sp_Manage_Payment_Terms");

      res.status(200).json({ message: "Payment term added successfully" });
    }
  } catch (err) {
    logger.error(err);
    console.error("Error adding payment term:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/update-payment-term", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];

    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      const { id, payment_type, percentage, is_active } = req.body;
      if (
        id == null ||
        payment_type == null ||
        percentage == null ||
        is_active == null
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await pool
        .request()
        .input("id", sql.Int, id)
        .input("payment_type", sql.VarChar(50), payment_type)
        .input("percentage", sql.Decimal(5, 2), percentage)
        .input("is_active", sql.Bit, is_active)
        .execute("dbo.sp_Upd_Payment_Term");

      return res
        .status(200)
        .json({ message: "Payment term updated successfully" });
    }
  } catch (err) {
    logger.error(err);
    console.error("Error adding payment term:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.use((req, res) => {
  return res.status(404).json({
    error: `${req.originalUrl} Not Found`,
  });
});
module.exports = router;
