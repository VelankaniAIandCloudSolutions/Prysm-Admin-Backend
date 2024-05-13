require("dotenv").config();
const express = require("express");
const jsonwebtoken = require("jsonwebtoken");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const crypto = require("crypto");
var CryptoJS = require("crypto-js");
const bcrypt = require("bcrypt");

const {
  decodeToken,
  verifyToken,
  handleServerError,
} = require("../Helper/helper");

// router.post("/", async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     // let decryptPassword = (db_password) => {
//     //   return CryptoJS.AES.decrypt(db_password, "cipherAce").toString(
//     //     CryptoJS.enc.Utf8
//     //   );
//     // };

//     // Function to hash a password
//     async function hashPassword(password) {
//       const saltRounds = 10; // This determines the complexity of the hashing algorithm
//       return await bcrypt.hash(password, saltRounds);
//     }

//     // Function to verify a password
//     async function verifyPassword(password, hashedPassword) {
//       return await bcrypt.compare(password, hashedPassword);
//     }

//     let pool = await sql?.connect(config);
//     let userList = (await pool?.query("Select * from mas_user_account")) // pool?.request()?.execute("sp_Get_User_Account")
//       .recordsets[0];
//     // const deCryptPassword = decryptPassword(password);
//     console.log("password plain from frotn-end", password);
//     const hashedPassword = await hashPassword(password);
//     console.log("hashed password", hashedPassword);
//     userList.forEach(async (val) => {
//       console.log("Processing user:", val.email); // Log non-sensitive information

//       // Log hashed password and user's password
//       console.log("Hashed password:", hashedPassword);
//       console.log("User's password:", val.password);
//       if (
//         username === val.email &&
//         (await verifyPassword(hashedPassword, val.password))
//       ) {
//         try {
//           let resultLogin = pool
//             ?.request()
//             ?.input("Action", sql?.NVarChar(255), "UPDATE")
//             ?.input("user_id", sql?.Int, val.id)
//             ?.input("last_login", sql?.DateTimeOffset, new Date())
//             ?.output("userId", sql?.Int)
//             ?.execute("sp_Ins_Upd_User_Account");
//         } catch (error) {
//           logger.error(error, " Error in updating last login");
//         }

//         return res.json({
//           token: jsonwebtoken.sign(
//             {
//               user: val?.email,
//               role: val?.user_role_id,
//               userId: val?.id,
//               isStaff: val?.is_staff,
//             },
//             process.env.JWT_SECRET,
//             { expiresIn: "6h" }
//           ),
//         });
//       }
//     });
//     return res.status(401).json({
//       message: "Invalid username or password",
//     });
//   } catch (error) {
//     logger.error(error);
//     if (!res.headersSent) {
//       handleServerError(res, error);
//     }
//   }
// });
router.post("/", async (req, res) => {
  try {
    const { username, password } = req.body;

    async function hashPassword(password) {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
    }

    async function verifyPassword(password, hashedPassword) {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      console.log("Password match result:", isMatch);

      return isMatch;
    }
    const pool = await sql?.connect(config);
    const userList = (await pool?.query("Select * from mas_user_account"))
      .recordsets[0];

    // const hashedPassword = await hashPassword(password);

    for (const val of userList) {
      console.log("Processing user:", val.email);

      console.log("User's password:", val.password);
      const isMatch = await verifyPassword(password, val.password);

      if (username === val.email && isMatch) {
        try {
          let resultLogin = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("user_id", sql?.Int, val.id)
            ?.input("last_login", sql?.DateTimeOffset, new Date())
            ?.output("userId", sql?.Int)
            ?.execute("sp_Ins_Upd_User_Account");
        } catch (error) {
          logger.error(error, "Error in updating last login");
        }

        return res.json({
          token: jsonwebtoken.sign(
            {
              user: val?.email,
              role: val?.user_role_id,
              userId: val?.id,
              isStaff: val?.is_staff,
            },
            process.env.JWT_SECRET,
            { expiresIn: "6h" }
          ),
        });
      }
    }

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

// router.post("/", async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     let decryptPassword = (db_password) => {
//       return CryptoJS.AES.decrypt(db_password, "cipherAce").toString(
//         CryptoJS.enc.Utf8
//       );
//     };

//     // Function to hash a password
//     async function hashPassword(password) {
//       const saltRounds = 10; // This determines the complexity of the hashing algorithm
//       return await bcrypt.hash(password, saltRounds);
//     }

//     // Function to verify a password
//     async function verifyPassword(password, hashedPassword) {
//       return await bcrypt.compare(password, hashedPassword);
//     }

//     let pool = await sql?.connect(config);
//     let userList = (await pool?.query("Select * from mas_user_account")) // pool?.request()?.execute("sp_Get_User_Account")
//       .recordsets[0];
//     const deCryptPassword = decryptPassword(password);
//     console.log("password pain from frotn-end", password);
//     const hashedPassword = await hashPassword(password);
//     // console.log("hashed password", hashedPassword);
//     userList.forEach(async (val) => {
//       console.log("Processing user:", val.email); // Log non-sensitive information

//       // // Log hashed password and user's password
//       // console.log("Hashed password:", hashedPassword);
//       console.log(" Decrypt pSSWORD", deCryptPassword);
//       console.log("User's password:", val.password);
//       if (
//         username === val.email &&
//         deCryptPassword === decryptPassword(val.password)
//       ) {
//         try {
//           let resultLogin = pool
//             ?.request()
//             ?.input("Action", sql?.NVarChar(255), "UPDATE")
//             ?.input("user_id", sql?.Int, val.id)
//             ?.input("last_login", sql?.DateTimeOffset, new Date())
//             ?.output("userId", sql?.Int)
//             ?.execute("sp_Ins_Upd_User_Account");
//         } catch (error) {
//           logger.error(error, " Error in updating last login");
//         }

//         return res.json({
//           token: jsonwebtoken.sign(
//             {
//               user: val?.email,
//               role: val?.user_role_id,
//               userId: val?.id,
//               isStaff: val?.is_staff,
//             },
//             process.env.JWT_SECRET,
//             { expiresIn: "6h" }
//           ),
//         });
//       }
//     });
//     return res.status(401).json({
//       message: "Invalid username or password",
//     });
//   } catch (error) {
//     logger.error(error);
//     if (!res.headersSent) {
//       handleServerError(res, error);
//     }
//   }
// });

router.use((req, res) => {
  return res.status(404).json({
    error: `${req.originalUrl} Not Found`,
  });
});

module.exports = router;
