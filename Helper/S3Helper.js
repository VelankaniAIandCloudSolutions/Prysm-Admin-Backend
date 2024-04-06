const { S3 } = require("aws-sdk");

//const { S3 } = require("aws-sdk");
require("dotenv").config();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const s3 = new S3({
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,  
    secretAccessKey: process.env.S3_BUCKET_SECRET, 
    Bucket: process.env.S3_BUCKET_NAME
  });



 const s3upload = function (params) {
    return new Promise((resolve, reject) => {
        s3.createBucket({
            Bucket: BUCKET_NAME      
        }, function () {
            s3.putObject(params, function (err, data) {
                if (err) {
                    reject(err)
                } else {
                     console.log("Successfully uploaded data to bucket");
                    resolve(data);
                }
            });
        });
    });
}
 const s3download = function (params) {
    return new Promise((resolve, reject) => {
        s3.createBucket({
            Bucket: BUCKET_NAME       
        }, function () {
            s3.getObject(params, function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    console.log("Successfully dowloaded data from  bucket");
                    resolve(data);
                }
            });
        });
    });
}

 const s3delete = function (params) {
    return new Promise((resolve, reject) => {
        s3.createBucket({
            Bucket: BUCKET_NAME  
        }, function () {
            s3.deleteObject(params, function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    console.log("Successfully deleted data from  bucket");
                    resolve(data);
                }
            });
        });
    });
}
module.exports = {s3download, s3upload, s3delete}