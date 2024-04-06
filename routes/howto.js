require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const { verifyToken, decodeToken, handleServerError } = require("../Helper/helper");

router.get("/", async (req, res) => {
  try {
    const pool = await sql?.connect(config);
    const result = await pool?.request()?.execute("sp_Get_Howto");
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
      ?.input("howtoID", sql?.Int, id)
      ?.execute("sp_Get_Howto_By_ID");

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
      let howtoData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("howto_id", sql?.Int, null)
        ?.input("link_name", sql?.NVarChar(255), howtoData?.linkName)
        ?.input("status", sql?.Int, howtoData?.status)
        ?.input("raw_content", sql?.NVarChar(sql?.MAX), howtoData?.rawContent)
        ?.input("os_ids", howtoData?.osIds)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("howtoID", sql?.Int)
        ?.execute("sp_Ins_Upd_Howto");

      const howtoID = result.output.howtoID;
      if (howtoID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Howto ID = ${howtoID}`,
        howtoID: howtoID,
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
      let howtoData = req.body;
      let howtoId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("howto_id", sql?.Int, howtoId)
        ?.input("link_name", sql?.NVarChar(255), howtoData?.linkName)
        ?.input("status", sql?.Int, howtoData?.status)
        ?.input("raw_content", sql?.NVarChar(sql?.MAX), howtoData?.rawContent)
        ?.input("os_ids", howtoData?.osIds)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("howtoID", sql?.Int)
        ?.execute("sp_Ins_Upd_Howto");

      const howtoID = result.output.howtoID;
      if (howtoID === null) {
        return res.status(404).json({
          message: "Howto not found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Howto ID = ${howtoID}`,
        howtoID: howtoID,
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
      let id = req.params.id;
      let result = await pool
        ?.request()
        ?.input("howto_id", sql?.Int, id)
        ?.output("deletedHowtoId", sql?.Int)
        ?.execute("sp_Del_Howto");

      const delId = result.output.deletedHowtoId;
      if (delId === null) {
        return res.status(404).json({
          message: "Howto not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        howtoId: delId,
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
