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
    const result = await pool?.request()?.execute("sp_Get_file_attachments");
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
      ?.input("fileAttachmentId", sql?.Int, id)
      ?.execute("sp_Get_file_attachments_By_ID");

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
      let fileAttachment = req?.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("file_attachment_id", sql?.Int, null)
        ?.input("eticket_id", sql?.Int, fileAttachment?.eticketID)
        ?.output("fileAttachmentID", sql?.Int)
        ?.execute("sp_Ins_Upd_file_attachments");

      const fileAttachmentID = result.output.fileAttachmentID;
      if (
        fileAttachmentID !== null &&
        fileAttachmentID !== "" &&
        fileAttachmentID !== -1
      ) {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        if (req?.files?.file) {
          const fileUploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Body: req?.files?.file.data,
            Key:
              "FileAttachments/" + fileAttachmentID + "/" + uuid?.output?.UUID,
          };
          await s3upload(fileUploadParams);

          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("file_attachment_id", sql?.Int, fileAttachmentID)
            ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
            ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
            ?.input(
              "file_size",
              sql?.NVarChar,
              req?.files?.file.size?.toString()
            )
            ?.input("file_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
            ?.input(
              "file_path",
              sql?.NVarChar,
              "FileAttachments" +
                "/" +
                fileAttachmentID +
                "/" +
                uuid?.output?.UUID
            )
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("fileAttachmentID", sql?.Int)
            ?.execute("sp_Ins_Upd_file_attachments");
        }
      }
      if (fileAttachmentID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Manual ID = ${fileAttachmentID}`,
        fileAttachmentID: fileAttachmentID,
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
      let fileAttachment = req?.body;
      let id = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("file_attachment_id", sql?.Int, id)
        ?.input("eticket_id", sql?.Int, fileAttachment?.eticketID)
        ?.output("fileAttachmentID", sql?.Int)
        ?.execute("sp_Ins_Upd_file_attachments");
      const fileAttachmentID = result.output.fileAttachmentID;
      if (
        fileAttachmentID !== null &&
        fileAttachmentID !== "" &&
        fileAttachmentID !== -1
      ) {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "fileAttachments")
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
              Key:
                "FileAttachments/" +
                fileAttachmentID +
                "/" +
                uuid?.output?.UUID,
            };
            await s3upload(fileUploadParams);

            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("file_attachment_id", sql?.Int, fileAttachmentID)
              ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
              ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
              ?.input(
                "file_size",
                sql?.NVarChar,
                req?.files?.file.size?.toString()
              )
              ?.input("file_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
              ?.input(
                "file_path",
                sql?.NVarChar,
                "FileAttachments/" + fileAttachmentID + "/" + uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("fileAttachmentID", sql?.Int)
              ?.execute("sp_Ins_Upd_file_attachments");
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
              ?.input("file_attachment_id", sql?.Int, fileAttachmentID)
              ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
              ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
              ?.input(
                "file_size",
                sql?.NVarChar,
                req?.files?.file.size?.toString()
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("fileAttachmentID", sql?.Int)
              ?.execute("sp_Ins_Upd_file_attachments");
          }
        }
      }
      if (fileAttachmentID === null) {
        return res.status(404).json({
          message: "File not found.",
        });
      } else if (fileAttachmentID === -1) {
        return res.status(409).json({
          message: "File already exists.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Problem ID = ${fileAttachmentID}`,
        fileAttachmentID: fileAttachmentID,
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
