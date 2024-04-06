require("dotenv").config();
const express = require("express");
const router = express.Router();
const logger = require("../logger");
const { s3download } = require("../Helper/S3Helper");
const {
  handleServerError,
} = require("../Helper/helper");

router.get("/:lng/:ns", async (req, res) => {
    const { lng,ns } = req.params;
  try {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `Content/${lng}/${ns}.json`,
      };
      const dataresult = await s3download(params);
      const json = { ...JSON.parse(dataresult.Body.toString()) };
      if(json){
      res.status(200).json(json);
      }
      else {
      res.status(404).send("Data not found");
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
