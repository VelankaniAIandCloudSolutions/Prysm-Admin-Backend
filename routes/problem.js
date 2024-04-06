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
    const result = await pool?.request()?.execute("sp_Get_Problem");
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
      ?.input("problemId", sql?.Int, id)
      ?.execute("sp_Get_Problem_By_ID");

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
      let problemData = req?.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("problem_id", sql?.Int, null)
        ?.input("problem_type", sql?.NVarChar(255), problemData?.problemType)
        ?.input("status", sql?.Int, problemData?.status)
        ?.input(
          "problem_description",
          sql?.NVarChar(sql?.MAX),
          problemData?.problemDescription
        )
        ?.output("problemID", sql?.Int)
        ?.execute("sp_Ins_Upd_Problem");

      const problemID = result.output.problemID;

      if (problemID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with problemID = ${problemID}`,
        problemID: problemID,
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
      let problemData = req?.body;
      let id = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("problem_id", sql?.Int, id)
        ?.input("problem_type", sql?.NVarChar(255), problemData?.problemType)
        ?.input("status", sql?.Int, problemData?.status)
        ?.input(
          "problem_description",
          sql?.NVarChar(sql?.MAX),
          problemData?.problemDescription
        )
        ?.output("problemID", sql?.Int)
        ?.execute("sp_Ins_Upd_Problem");

      const problemID = result.output.problemID;
      if (problemID === null) {
        return res.status(404).json({
          message: "Problem Type not found.",
        });
      } else if (problemID === -1) {
        return res.status(409).json({
          message: `Problem Type ${problemData?.problemType} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Problem ID = ${problemID}`,
        problemID: problemID,
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
