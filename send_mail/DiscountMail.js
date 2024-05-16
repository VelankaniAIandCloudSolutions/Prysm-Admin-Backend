const { sendmail } = require("./sendMail");

const sendDiscountApprovalMail = (
  recipientEmail,
  totalAmount,
  discountAmount
) => {
  const mailData = {
    receiverEmailID: recipientEmail,
    subject: `Discount Approved for the Order `,
    body: `
      <p>Congratulations!</p>
      <p>The discount for your order has been approved.</p>
      
      <p>Total Price: ${totalAmount}</p>
      <p>Discounted Price: ${discountAmount}</p>
      <p>Thank you for shopping with us!</p>
    `,
  };

  return sendmail(mailData);
};

module.exports = { sendDiscountApprovalMail };
