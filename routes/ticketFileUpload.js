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
const { s3download, s3upload, s3delete } = require("../Helper/S3Helper");

// POST
router.post("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let pool = await sql?.connect(config);
      let file = req?.body;
      let uuid = await pool
        ?.request()
        ?.output("UUID", sql.UniqueIdentifier)
        ?.execute("sp_Generate_UUID");

      var buf = Buffer.from(
        file?.fileContent.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      const fileUrl = `TicketFileUploads/${uuid?.output?.UUID}/${file?.fileName}`;
      const fileUploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Body: buf,
        Key: fileUrl,
        ContentEncoding: "base64",
        ContentType: file?.fileExtension,
      };
      await s3upload(fileUploadParams);
      res.status(200).json({
        path: fileUrl,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

module.exports = router;