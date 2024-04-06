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
    let result = await pool?.request()?.execute("sp_Get_Driver_Version");
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
      ?.input("versionId", sql?.Int, id)
      ?.execute("sp_Get_Driver_Version_By_ID");

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
      let driverVersionData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("version_id", sql?.Int, null)
        ?.input(
          "change_history",
          sql?.NVarChar(255),
          driverVersionData?.changeHistory
        )
        ?.input("status", sql?.Int, driverVersionData?.status)
        ?.input("version", sql?.NVarChar, driverVersionData?.version)
        ?.input("release_date", sql?.DateTime, driverVersionData?.releaseDate)
        ?.input("driver_id", sql?.Int, driverVersionData?.driverId)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("driverVersionID", sql?.Int)
        ?.execute("sp_Ins_Upd_Driver_Version");

      const driverVersionID = result.output.driverVersionID;

      if (driverVersionID !== null && driverVersionID !== "") {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        if (req?.files?.file) {
          const fileUploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Body: req?.files?.file.data,
            Key: "DriverVersion/" + driverVersionID + "/" + uuid?.output?.UUID,
          };
          await s3upload(fileUploadParams);

          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("version_id", sql?.Int, driverVersionID)
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
              "DriverVersion" + "/" + driverVersionID + "/" + uuid?.output?.UUID
            )
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("driverVersionID", sql?.Int)
            ?.execute("sp_Ins_Upd_Driver_Version");
        }
      }

      if (driverVersionID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Version ID = ${driverVersionID}`,
        driverVersionID: driverVersionID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

//PUT
router.put("/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let driverVersionData = req.body;
      let versionId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("version_id", sql?.Int, versionId)
        ?.input(
          "change_history",
          sql?.NVarChar(255),
          driverVersionData?.changeHistory
        )
        ?.input("status", sql?.Int, driverVersionData?.status)
        ?.input("version", sql?.NVarChar, driverVersionData?.version)
        ?.input("release_date", sql?.DateTime, driverVersionData?.releaseDate)
        ?.input("driver_id", sql?.Int, driverVersionData?.driverId)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("driverVersionID", sql?.Int)
        ?.execute("sp_Ins_Upd_Driver_Version");

      const driverVersionID = result.output.driverVersionID;

      if (driverVersionID !== null && driverVersionID !== "") {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "driverVersion")
          ?.input("id", sql?.Int, driverVersionID)
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
                "DriverVersion/" + driverVersionID + "/" + uuid?.output?.UUID,
            };
            await s3upload(fileUploadParams);

            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("version_id", sql?.Int, driverVersionID)
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
                "DriverVersion" +
                  "/" +
                  driverVersionID +
                  "/" +
                  uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("driverVersionID", sql?.Int)
              ?.execute("sp_Ins_Upd_Driver_Version");
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
              ?.input("version_id", sql?.Int, driverVersionID)
              ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
              ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
              ?.input(
                "file_size",
                sql?.NVarChar,
                req?.files?.file.size?.toString()
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("driverVersionID", sql?.Int)
              ?.execute("sp_Ins_Upd_Driver_Version");
          }
        }
      }

      if (driverVersionID === null) {
        return res.status(404).json({
          message: "Driver Version not found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Version ID = ${driverVersionID}`,
        driverVersionID: driverVersionID,
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
