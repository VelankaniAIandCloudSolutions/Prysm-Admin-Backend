require("dotenv").config();
const express = require("express");
const jsonwebtoken = require("jsonwebtoken");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
var CryptoJS = require("crypto-js");

const { decodeToken, verifyToken, handleServerError } = require("../Helper/helper");

router.post("/", async (req, res) => {
  try {
    const { username, password } = req.body;
    let decryptPassword = (db_password) => {
      return CryptoJS.AES.decrypt(db_password, "cipherAce").toString(
        CryptoJS.enc.Utf8
      );
    };

    let pool = await sql?.connect(config);
    let userList = (await pool?.query("Select * from mas_user_account")) // pool?.request()?.execute("sp_Get_User_Account")
      .recordsets[0];
    const deCryptPassword = decryptPassword(password);
    userList.forEach((val) => {
      if (
        username === val.email &&
        deCryptPassword === decryptPassword(val.password)
      ) {
        try {
          let resultLogin = pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("user_id", sql?.Int, val.id)
            ?.input("last_login", sql?.DateTimeOffset, new Date())
            ?.output("userId", sql?.Int)
            ?.execute("sp_Ins_Upd_User_Account");
        } catch (error) {
          logger.error(error, " Error in updating last login");
        }

        return res.json({
          token: jsonwebtoken.sign(
            {
              user: val?.email,
              role: val?.user_role_id,
              userId: val?.id,
              isStaff:val?.is_staff
            },
            process.env.JWT_SECRET,
            { expiresIn: "6h" }
          ),
        });
      }
    });
    return res.status(401).json({
      message: "Invalid username or password",
    });
  } catch (error) {
    logger.error(error);
    if (!res.headersSent) {
      handleServerError(res, error);
    }
  }
});

router.use((req, res) => {
  return res.status(404).json({
    error: `${req.originalUrl} Not Found`,
  });
});

module.exports = router;
