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
      const result = await pool?.request()?.execute("sp_Get_Ticket_Status");
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
  const { id } = req?.params;
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool
        ?.request()
        ?.input("statusID", sql?.Int, id)
        ?.execute("sp_Get_Ticket_Status_By_ID");

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

      const statusData = req?.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("status_id", sql?.Int, null)
        ?.input("status_name", sql?.NVarChar(50), statusData?.statusName)
        ?.input("description", sql?.NVarChar(sql?.MAX), statusData?.description)
        ?.input("is_active", sql?.Int, statusData?.isActive)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("statusID", sql?.Int)
        ?.execute("sp_Ins_Upd_Ticket_Status");

      const statusID = result.output.statusID;
      if (statusID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Status ID = ${statusID}`,
        statusID: statusID,
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
      const statusData = req?.body;
      let statusId = req?.params?.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("status_id", sql?.Int, statusId)
        ?.input("status_name", sql?.NVarChar(50), statusData?.statusName)
        ?.input("description", sql?.NVarChar(sql?.MAX), statusData?.description)
        ?.input("is_active", sql?.Int, statusData?.isActive)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("statusID", sql?.Int)
        ?.execute("sp_Ins_Upd_Ticket_Status");

      const updatedStatusID = result.output.statusID;
      if (updatedStatusID === null) {
        res.status(404).json({
          message: "Ticket Status Not Found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Status ID = ${updatedStatusID}`,
        statusID: updatedStatusID,
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
    error: `${req?.originalUrl} Not Found`,
  });
});

module.exports = router;
