require("dotenv").config();
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport')
const logger = require('../logger');

const sendmail = (mailData, uuid) => {
const transporter = nodemailer.createTransport(smtpTransport({
    name: 'mail.cipheracetech.com', 
    host: 'mail.cipheracetech.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },tls: {
        rejectUnauthorized: false,
        },
}));

const mailOptions = {
    from: process.env.EMAIL_USER,
    to: (mailData?.receiverEmailID).toString(),
    subject: (mailData?.subject + "<UUID>" + uuid + "</UUID>").toString(),
    html: (mailData?.body).toString(),
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        logger.error("ERROR: ", error);
        return false;
    } else {
        console.log('Email sent:', info.response);
        return info.messageId;
    }
});
}

module.exports = { sendmail };