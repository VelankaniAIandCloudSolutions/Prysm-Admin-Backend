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
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool?.request()?.execute("sp_Get_Discount_Code");
      res.status(200).json(result.recordsets[0]);
    }
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
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool
        ?.request()
        ?.input("discountCodeID", sql?.Int, id)
        ?.execute("sp_Get_Discount_Code_By_ID");

      if (
        Object.values(Object.values(result.recordsets[0])[0])[0].length === 0
      ) {
        res.status(404).send("Data not found");
      } else {
        const abc = JSON.parse(
          Object.values(Object.values(result.recordsets[0])[0])
        );
        res.json(abc);
      }
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

      const discountCodeData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("discountCodeID", sql?.Int, null)
        ?.input("is_active", sql?.Int, discountCodeData?.isActive)
        ?.input(
          "discount_code",
          sql?.NVarChar(255),
          discountCodeData?.discountCode
        )
        ?.input(
          "discount_percentage",
          sql?.Numeric(5, 2),
          discountCodeData?.discountPercentage
        )
        ?.input(
          "discount_amount",
          sql?.Numeric(10, 2),
          discountCodeData?.discountAmount
        )
        ?.input("note", sql?.NVarChar(sql?.MAX), discountCodeData?.note)
        ?.input(
          "max_usage_per_user",
          sql?.Int,
          discountCodeData?.maxUsagePerUser
        )
        ?.input(
          "expiration_date",
          sql?.DateTimeOffset,
          discountCodeData?.expirationDate
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input(
          "max_number_of_applicable_products",
          sql?.Int,
          discountCodeData?.maxNumberOfApplicableProducts
        )
        ?.input(
          "min_amount_for_discount",
          sql?.Numeric(10, 2),
          discountCodeData?.minAmountForDiscount
        )
        ?.input(
          "max_discount_amount",
          sql?.Numeric(10, 2),
          discountCodeData?.maxDiscountAmount
        )
        ?.output("discountCodeIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Discount_Code");

      const discountCodeIDOutput = result.output.discountCodeIDOutput;

      // add and remove applicable products
      if (discountCodeIDOutput !== null) {
        if (discountCodeData?.addProduct.length > 0) {
          for (const productID of discountCodeData?.addProduct) {
            let addProductResult = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("discountCodeID", sql?.Int, discountCodeIDOutput)
              ?.input("productID", sql?.Int, productID)
              ?.output("applicableProductIDOutput", sql?.BigInt)
              ?.execute("sp_Ins_Upd_Discount_Code_Applicable_Products");

            const applicableProductIDOutput =
              addProductResult.output.applicableProductIDOutput;
          }
        }
        if (discountCodeData?.removeProduct.length > 0) {
          for (const productID of discountCodeData?.removeProduct) {
            let removeProductResult = await pool
              ?.request()
              ?.input("discountCodeID", sql?.Int, discountCodeIDOutput)
              ?.input("productID", sql?.Int, productID)
              ?.execute("sp_Del_Discount_Code_Applicable_Product");
          }
        }
      }
      if (discountCodeIDOutput === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Discount Code ID = ${discountCodeIDOutput}`,
        discountCodeID: discountCodeIDOutput,
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
      const discountCodeData = req.body;
      let discountCodeID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("discountCodeID", sql?.Int, discountCodeID)
        ?.input("is_active", sql?.Int, discountCodeData?.isActive)
        ?.input(
          "discount_code",
          sql?.NVarChar(255),
          discountCodeData?.discountCode
        )
        ?.input(
          "discount_percentage",
          sql?.Numeric(5, 2),
          discountCodeData?.discountPercentage
        )
        ?.input(
          "discount_amount",
          sql?.Numeric(10, 2),
          discountCodeData?.discountAmount
        )
        ?.input("note", sql?.NVarChar(sql?.MAX), discountCodeData?.note)
        ?.input(
          "max_usage_per_user",
          sql?.Int,
          discountCodeData?.maxUsagePerUser
        )
        ?.input(
          "expiration_date",
          sql?.DateTimeOffset,
          discountCodeData?.expirationDate
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input(
          "max_number_of_applicable_products",
          sql?.Int,
          discountCodeData?.maxNumberOfApplicableProducts
        )
        ?.input(
          "min_amount_for_discount",
          sql?.Numeric(10, 2),
          discountCodeData?.minAmountForDiscount
        )
        ?.input(
          "max_discount_amount",
          sql?.Numeric(10, 2),
          discountCodeData?.maxDiscountAmount
        )
        ?.output("discountCodeIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Discount_Code");

      const updatedDiscountCodeID = result.output.discountCodeIDOutput;
      // add and remove applicable products
      if (updatedDiscountCodeID !== null && updatedDiscountCodeID !== -1) {
        if (discountCodeData?.addProduct.length > 0) {
          for (const productID of discountCodeData?.addProduct) {
            let addProductResult = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("discountCodeID", sql?.Int, updatedDiscountCodeID)
              ?.input("productID", sql?.Int, productID)
              ?.output("applicableProductIDOutput", sql?.BigInt)
              ?.execute("sp_Ins_Upd_Discount_Code_Applicable_Products");

            const applicableProductIDOutput =
              addProductResult.output.applicableProductIDOutput;
          }
        }
        if (discountCodeData?.removeProduct.length > 0) {
          for (const productID of discountCodeData?.removeProduct) {
            let removeProductResult = await pool
              ?.request()
              ?.input("discountCodeID", sql?.Int, updatedDiscountCodeID)
              ?.input("productID", sql?.Int, productID)
              ?.execute("sp_Del_Discount_Code_Applicable_Product");
          }
        }
      }
      if (updatedDiscountCodeID === null) {
        res.status(404).json({
          message: "Discount Code Not Found.",
        });
      } else if (updatedDiscountCodeID === -1) {
        res.status(409).json({
          message: `Discount Code ${discountCodeData?.discountCode} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Discount Code ID = ${updatedDiscountCodeID}`,
        discountCodeID: updatedDiscountCodeID,
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
