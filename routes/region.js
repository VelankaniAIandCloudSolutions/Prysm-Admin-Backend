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
      const result = await pool?.request()?.execute("sp_Get_Region");
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
        ?.input("regionID", sql?.Int, id)
        ?.execute("sp_Get_Region_By_ID");

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

      const regionData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("regionID", sql?.Int, null)
        ?.input("is_active", sql?.Int, regionData?.isActive)
        ?.input("name", sql?.NVarChar(255), regionData?.regionName)
        ?.input("country_id", sql?.Int, regionData?.countryID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("regionIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Region");

      const regionID = result.output.regionIDOutput;
      if (regionID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Region ID = ${regionID}`,
        regionID: regionID,
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
      const regionData = req.body;
      let regionID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("regionID", sql?.Int, regionID)
        ?.input("is_active", sql?.Int, regionData?.isActive)
        ?.input("name", sql?.NVarChar(255), regionData?.regionName)
        ?.input("country_id", sql?.Int, regionData?.countryID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("regionIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Region");

      const updatedRegionID = result.output.regionIDOutput;
      if (updatedRegionID === null) {
        res.status(404).json({
          message: "Region Not Found.",
        });
      } else if (updatedRegionID === -1) {
        res.status(409).json({
          message: `Region name ${regionData?.regionName} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Region ID = ${updatedRegionID}`,
        regionID: updatedRegionID,
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
