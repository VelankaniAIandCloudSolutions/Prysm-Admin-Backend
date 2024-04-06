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
    let result = await pool?.request()?.execute("sp_Get_Driver");
    return res.status(200).json(result.recordsets[0]);
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
    let result = await pool
      ?.request()
      ?.input("driverID", sql?.Int, id)
      ?.execute("sp_Get_Driver_with_Version");
    if (Object.values(Object.values(result.recordsets[0])[0])[0].length === 0) {
      res.status(404).send("Data not found");
    } else {
      const abc = JSON.parse(
        Object.values(Object.values(result.recordsets[0])[0])
      );
      res.json(abc);
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
      let driverData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("driver_id", sql?.Int, null)
        ?.input("name", sql?.NVarChar(255), driverData?.name)
        ?.input("description", sql?.NVarChar(255), driverData?.description)
        ?.input("status", sql?.Int, driverData?.status)
        ?.input("driver_grp_id", sql?.Int, driverData?.driverGrpId)
        ?.input("os_id", sql?.NVarChar, driverData?.osId)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("driverID", sql?.Int)
        ?.execute("sp_Ins_Upd_Driver");

      const driverID = result.output.driverID;
      if (driverID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Driver ID = ${driverID}`,
        driverID: driverID,
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
      let driverData = req.body;
      let driverId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("driver_id", sql?.Int, driverId)
        ?.input("name", sql?.NVarChar(255), driverData?.name)
        ?.input("description", sql?.NVarChar(255), driverData?.description)
        ?.input("status", sql?.Int, driverData?.status)
        ?.input("driver_grp_id", sql?.Int, driverData?.driverGrpId)
        ?.input("os_id", sql?.NVarChar, driverData?.osId)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("driverID", sql?.Int)
        ?.execute("sp_Ins_Upd_Driver");

      const driverID = result.output.driverID;
      if (driverID === null) {
        return res.status(404).json({
          message: "Driver not found.",
        });
      } else if (driverID === -1) {
        return res.status(409).json({
          message: `Driver ${driverData?.name} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Driver ID = ${driverID}`,
        driverID: driverID,
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
