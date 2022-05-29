const functions = require("firebase-functions");
const phoneNumber = functions.config().secret.phone_number;
const accountSid = functions.config().secret.twillo_account_sid;
const authToken = functions.config().secret.twillo_auth_token;
const client = require("twilio")(accountSid, authToken);

module.exports = async (restaurantNo, message) => {
  try {
    let result = await client.messages.create({
      from: `whatsapp:${phoneNumber}`,
      body: message,
      to: `whatsapp:${restaurantNo}`,
    });

    return Promise.resolve(result);
  } catch (error) {
    return Promise.reject(error);
  }
};
