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
    let result = await pool?.request()?.execute("sp_Get_Os");
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
      ?.input("osID", sql?.Int, id)
      ?.execute("sp_Get_Os_By_ID");

    if (result.recordsets[0].length === 0) {
      res.status(404).send("Data not found");
    } else {
      res.json(result.recordsets[0]);
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
      let osData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("os_id", sql?.Int, null)
        ?.input("name", sql?.NVarChar(255), osData?.name)
        ?.input("status", sql?.Int, osData?.status)
        ?.input("parent_os_id", sql?.Int, osData?.parentOsID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("osID", sql?.Int)
        ?.execute("sp_Ins_Upd_Os");

      const osID = result.output.osID;
      if (osID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with OS ID = ${osID}`,
        osID: osID,
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
      let osData = req.body;
      let osID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("os_id", sql?.Int, osID)
        ?.input("name", sql?.NVarChar(255), osData?.name)
        ?.input("status", sql?.Int, osData?.status)
        ?.input("parent_os_id", sql?.Int, osData?.parentOsID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("osID", sql?.Int)
        ?.execute("sp_Ins_Upd_Os");

      const updatedOsID = result.output.osID;
      if (updatedOsID === null) {
        return res.status(404).json({
          message: "OS not found.",
        });
      } else if (updatedOsID === -1) {
        return res.status(409).json({
          message: `OS ${osData?.name} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with OS ID = ${updatedOsID}`,
        osID: updatedOsID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let pool = await sql?.connect(config);
      let osId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("osId", sql?.Int, osId)
        ?.output("deletedOsId", sql?.Int)
        ?.execute("sp_Del_Os");

      const deletedOsId = result.output.deletedOsId;
      if (deletedOsId === null) {
        return res.status(404).json({
          message: "OS not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${deletedOsId}`,
        osId: deletedOsId,
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
