const nodemailer = require("nodemailer")
const functions = require("firebase-functions")
const email = functions.config().secret.email
const password = functions.config().secret.password

module.exports = async (
  receiverEmail,
  tableBill,
  yourPayment,
  remaining,
  tip
) => {
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  })

  let mailOptions = {
    from: email,
    to: receiverEmail,
    subject: "Your Invoice",
    text: `
        Total Bill: ${tableBill}
        Remaining Bill: ${remaining}
        Your Payment: ${yourPayment}
        Tip: ${tip}`,
  }

  try {
    let result = await transporter.sendMail(mailOptions)
    return Promise.resolve(result)
  } catch (error) {
    return Promise.reject(error)
  }
}
