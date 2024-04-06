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

router.get("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool?.request()?.execute("sp_Get_Tax");
      res.status(200).json(result.recordsets[0]);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool
        ?.request()
        ?.input("taxID", sql?.Int, id)
        ?.execute("sp_Get_Tax_By_ID");

      if (result.recordsets[0].length === 0) {
        res.status(404).send("Data not found");
      } else {
        res.json(result.recordsets[0]);
      }
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST
router.post("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];

    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);

      const taxData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("tax_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, taxData?.isActive)
        ?.input("tax_name", sql?.NVarChar(255), taxData?.taxName)
        ?.input("tax_percentage", sql?.Numeric(5, 2), taxData?.taxPercentage)
        ?.input("note", sql?.NVarChar(sql?.MAX), taxData?.note)
        ?.input("country_id", sql?.Int, taxData?.countryID)
        ?.input("region_id", sql?.Int, taxData?.regionID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("taxID", sql?.Int)
        ?.execute("sp_Ins_Upd_Tax");

      const taxID = result.output.taxID;
      if (taxID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Tax ID = ${taxID}`,
        taxID: taxID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// PUT
router.put("/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      const taxData = req.body;
      let taxId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("tax_id", sql?.Int, taxId)
        ?.input("is_active", sql?.Int, taxData?.isActive)
        ?.input("tax_name", sql?.NVarChar(255), taxData?.taxName)
        ?.input("tax_percentage", sql?.Numeric(5, 2), taxData?.taxPercentage)
        ?.input("note", sql?.NVarChar(sql?.MAX), taxData?.note)
        ?.input("country_id", sql?.Int, taxData?.countryID)
        ?.input("region_id", sql?.Int, taxData?.regionID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("taxID", sql?.Int)
        ?.execute("sp_Ins_Upd_Tax");

      const updatedTaxID = result.output.taxID;
      if (updatedTaxID === null) {
        res.status(404).json({
          message: "Tax Not Found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Tax ID = ${updatedTaxID}`,
        taxID: updatedTaxID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.use((req, res) => {
  return res.status(404).json({
    error: `${req.originalUrl} Not Found`,
  });
});

module.exports = router;
