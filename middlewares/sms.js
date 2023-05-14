const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendMessage = (body, to) => {
  client.messages
    .create({
      body,
      to,
      from: "+15178159596",
    })
    .then((message) => console.log("Message sent."))
    .catch((error) => {
      console.log(error);
    });
};

module.exports = { sendMessage };
