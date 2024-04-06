require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const { s3download, s3upload } = require("../Helper/S3Helper");
const { verifyToken, decodeToken, handleServerError } = require("../Helper/helper");
const MAX = 99;

router.get("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: "Content/en/translation.json",
      };
      const dataresult = await s3download(params);
      const json = { ...JSON.parse(dataresult.Body.toString()) };
      const links = json?.footer?.links
      return res.status(200).json(links);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
    handleServerError(res, err);
    }
  }
});

router.post("/", async (req, res) => {
    try {
      const authHeader = req?.headers?.authorization;
      const token = authHeader?.split(" ")[1];
      if (verifyToken(res, token)) {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: "Content/en/translation.json",
      };
      const dataresult = await s3download(params);
      const json = { ...JSON.parse(dataresult.Body.toString()) };
      const footerJson = {...json["footer"]};
      const linksJson = req?.body?.links;
      delete footerJson["links"];
      footerJson["links"] = linksJson
      json["footer"] = footerJson
      const params2 = {
            Bucket: process.env.S3_BUCKET_NAME,
            Body: JSON.stringify(json),
            Key: "Content/en/translation.json",
          };
      await s3upload(params2);
      return res.status(200).json({
        message: "Sucessfully inserted the footer data",
      });
    }
        
    } catch (err) {
      logger.error(err);
      if (!res.headersSent) {
        handleServerError(res, err);
      }
    }
   }
  );

  router.use((req, res) => {
    return res.status(404).json({
      error: `${req.originalUrl} Not Found`,
    });
  });
  
  module.exports = router;