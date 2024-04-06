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
const { s3download, s3upload } = require("../Helper/S3Helper");

router.get("/", async (req, res) => {
  try {
    const pool = await sql?.connect(config);
    const result = await pool?.request()?.execute("sp_Get_Manuals");
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
      ?.input("manualsId", sql?.Int, id)
      ?.execute("sp_Get_Manuals_By_ID");

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
      let manualData = req?.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("manuals_id", sql?.Int, null)
        ?.input("link_name", sql?.NVarChar(255), manualData?.linkName)
        ?.input("status", sql?.Int, manualData?.status)
        ?.input("raw_content", sql?.NVarChar(sql?.MAX), manualData?.rawContent)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("manualID", sql?.Int)
        ?.execute("sp_Ins_Upd_Manuals");

      const manualId = result.output.manualID;

      if (manualId !== null && manualId !== "") {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        if (req?.files?.file) {
          const fileUploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Body: req?.files?.file.data,
            Key: "Manuals/" + manualId + "/" + uuid?.output?.UUID,
          };
          await s3upload(fileUploadParams);

          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("manuals_id", sql?.Int, manualId)
            ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
            ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
            ?.input(
              "file_size",
              sql?.NVarChar,
              req?.files?.file.size?.toString()
            )
            ?.input("file_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
            ?.input(
              "pdf_url",
              sql?.NVarChar,
              "Manuals" + "/" + manualId + "/" + uuid?.output?.UUID
            )
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("manualID", sql?.Int)
            ?.execute("sp_Ins_Upd_Manuals");
        }
      }

      if (manualId === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Manual ID = ${manualId}`,
        manualId: manualId,
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
      let manualData = req?.body;
      let mId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("manuals_id", sql?.Int, mId)
        ?.input("link_name", sql?.NVarChar(255), manualData?.linkName)
        ?.input("status", sql?.Int, manualData?.status)
        ?.input("raw_content", sql?.NVarChar(sql?.MAX), manualData?.rawContent)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("manualID", sql?.Int)
        ?.execute("sp_Ins_Upd_Manuals");

      const manualId = result.output.manualID;

      if (manualId !== null && manualId !== "") {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "manuals")
          ?.input("id", sql?.Int, manualId)
          ?.output("path", sql?.NVarChar)
          ?.execute("sp_Get_Resource_Path");
        if (path?.output?.path === null || path?.output?.path === "") {
          let uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");
          if (req?.files?.file) {
            const fileUploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Body: req?.files?.file.data,
              Key: "Manuals/" + manualId + "/" + uuid?.output?.UUID,
            };
            await s3upload(fileUploadParams);

            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("manuals_id", sql?.Int, manualId)
              ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
              ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
              ?.input(
                "file_size",
                sql?.NVarChar,
                req?.files?.file.size?.toString()
              )
              ?.input("file_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
              ?.input(
                "pdf_url",
                sql?.NVarChar,
                "Manuals" + "/" + manualId + "/" + uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("manualID", sql?.Int)
              ?.execute("sp_Ins_Upd_Manuals");
          }
        } else {
          if (req?.files?.file) {
            const fileUploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Body: req?.files?.file.data,
              Key: path?.output?.path,
            };
            await s3upload(fileUploadParams);

            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("manuals_id", sql?.Int, manualId)
              ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
              ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
              ?.input(
                "file_size",
                sql?.NVarChar,
                req?.files?.file.size?.toString()
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("manualID", sql?.Int)
              ?.execute("sp_Ins_Upd_Manuals");
          }
        }
      }

      if (manualId === null) {
        return res.status(404).json({
          message: "Manual not found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Manual ID = ${manualId}`,
        manualId: manualId,
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
        ?.input("manual_id", sql?.Int, id)
        ?.output("deletedManualId", sql?.Int)
        ?.execute("sp_Del_Manuals");

      const delId = result.output.deletedManualId;
      if (delId === null) {
        return res.status(404).json({
          message: "Manual not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        manualId: delId,
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
