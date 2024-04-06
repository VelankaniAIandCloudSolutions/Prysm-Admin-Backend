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
    const pool = await sql?.connect(config);
    const result = await pool
      ?.request()
      ?.execute("sp_Get_Country_Currency_Details");
    res.status(200).json(result.recordsets[0]);
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
    const pool = await sql?.connect(config);
    const result = await pool
      ?.request()
      ?.input("countryID", sql?.Int, id)
      ?.execute("sp_Get_Country_Region_Details_By_ID");

    if (Object.values(Object.values(result.recordsets[0])[0])[0].length === 0) {
      res.status(404).send("Data not found");
    } else {
      const data = JSON.parse(
        Object.values(Object.values(result.recordsets[0])[0])
      );
      res.json(data);
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

      const countryCurrencyData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("countryID", sql?.Int, null)
        ?.input("is_active", sql?.Int, countryCurrencyData?.isActive)
        ?.input("name", sql?.NVarChar(255), countryCurrencyData?.countryName)
        ?.input(
          "currency_code",
          sql?.NVarChar(3),
          countryCurrencyData?.currencyCode
        )
        ?.input(
          "forex_rate",
          sql?.Numeric(5, 2),
          countryCurrencyData?.forexRate
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("countryIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Country_Currency_Details");

      const insertedCountryID = result.output.countryIDOutput;
      if (insertedCountryID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Country ID = ${insertedCountryID}`,
        countryID: insertedCountryID,
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
      const countryCurrencyData = req.body;
      let countryID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("countryID", sql?.Int, countryID)
        ?.input("is_active", sql?.Int, countryCurrencyData?.isActive)
        ?.input("name", sql?.NVarChar(255), countryCurrencyData?.countryName)
        ?.input(
          "currency_code",
          sql?.NVarChar(3),
          countryCurrencyData?.currencyCode
        )
        ?.input(
          "forex_rate",
          sql?.Numeric(5, 2),
          countryCurrencyData?.forexRate
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("countryIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Country_Currency_Details");

      const updatedCountryID = result.output.countryIDOutput;
      if (updatedCountryID === null) {
        res.status(404).json({
          message: "Country Currency Details Not Found.",
        });
      } else if (updatedCountryID === -1) {
        res.status(409).json({
          message: `Country name ${countryCurrencyData?.countryName} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Country ID = ${updatedCountryID}`,
        countryID: updatedCountryID,
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
