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
    let result = await pool?.request()?.execute("sp_Get_Language");
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
      ?.input("langID", sql?.Int, id)
      ?.execute("sp_Get_Language_By_ID");

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
      let languageData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("lang_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, languageData?.isActive)
        ?.input("lang_code", sql?.NVarChar(10), languageData?.langCode)
        ?.input("lang_name", sql?.NVarChar(255), languageData?.langName)
        ?.input("description", sql?.NVarChar(512), languageData?.description)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("langId", sql?.Int)
        ?.execute("sp_Ins_Upd_Language");

      const langId = result.output.langId;
      if (langId === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Language ID = ${langId}`,
        langId: langId,
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
      let languageData = req.body;
      let langId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("lang_id", sql?.Int, langId)
        ?.input("is_active", sql?.Int, languageData?.isActive)
        ?.input("lang_code", sql?.NVarChar(10), languageData?.langCode)
        ?.input("lang_name", sql?.NVarChar(255), languageData?.langName)
        ?.input("description", sql?.NVarChar(512), languageData?.description)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("langId", sql?.Int)
        ?.execute("sp_Ins_Upd_Language");

      const updatedLangId = result.output.langId;
      if (updatedLangId === null) {
        return res.status(404).json({
          message: "Language not found.",
        });
      } else if (updatedLangId === -1) {
        return res.status(409).json({
          message: `Language ${languageData?.langCode} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Language ID = ${updatedLangId}`,
        langId: updatedLangId,
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
        ?.input("langId", sql?.Int, id)
        ?.output("deletedLangId", sql?.Int)
        ?.execute("sp_Del_Language");

      const delId = result.output.deletedLangId;
      if (delId === null) {
        return res.status(404).json({
          message: "Language not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        langId: delId,
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
