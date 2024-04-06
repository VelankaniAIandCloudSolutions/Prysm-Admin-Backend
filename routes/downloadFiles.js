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

router.post("/", (req, res) => {
  const { S3 } = require("aws-sdk");

  const BUCKET_NAME = process.env.S3_BUCKET_NAME;
  const s3 = new S3({
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.S3_BUCKET_SECRET,
    Bucket: process.env.S3_BUCKET_NAME,
  });

  try {
    const params = { Bucket: BUCKET_NAME, Key: req?.body?.fileName };

    s3.getObject(params, function (err, data) {
      if (err) {
        logger.error(err);
        res.status(500).send("Error Fetching File");
      } else {
        res.attachment(params.Key);
        res.type(data.ContentType);
        res.send(data.Body);
      }
    });
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
