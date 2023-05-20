require("dotenv").config();
const express = require("express");
const dayjs = require("dayjs");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const {
  patients,
  orders,
  facilities,
  couriers,
  generateOrderId,
} = require("./data");
const { sendMessage } = require("./middlewares/sms");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(express.urlencoded({ extended: false }));

let orderData = {};

//get time greeting
const Greetings = () => {
  let today = new Date();
  let hourNow = today.getHours();

  if (hourNow >= 0 && hourNow < 12) return "Good morning";
  if (hourNow >= 12 && hourNow < 18) return "Good afternoon";
  return "Good evening";
};

//USSD sender route
app.post("/ussd", (req, res) => {
  const { phoneNumber, text } = req.body;

  let response = "";
  let textArr = text.split("*");

  //check whether user already registered
  if (text == "") {
    const user = patients.find((p) => p.phone === phoneNumber);
    if (!user) {
      response = `END You are not yet registered. \n Use our website (curecab.com) or mobile app (Curecab) to register. \n`;
    } else {
      response = `CON ${Greetings()} ${
        user.full_name
      }. \n What can we do for you today? \n
          1. Make an order
          2. View recent orders
          3. Book an appointment`;
    }
  }

  //select facilities
  else if (text == "1") {
    const data = facilities
      .map((facility, i) => {
        return `${i + 1} : ${facility.name} \n`;
      })
      .join(" ");
    response = `CON Select your facility. \n ${data}`;
  }

  //show user orders
  else if (text == "2") {
    const yourOrders = orders.filter((o) => o.client === phoneNumber);
    const data = yourOrders
      .map((order) => {
        return `OrderID : ${order.orderId} \n Delivery Fee : Ksh ${
          order.deliveryFee
        } \n Status : ${order.status} \n Date : ${dayjs(order.orderDate).format(
          "DD/MM/YYYY HH:mm"
        )} \n\n`;
      })
      .join(" ");
    response = `END Recent orders. \n ${data}`;
  }

  //book appointment
  else if (text == "3") {
    response = `END To book an appointment, use Nishauri from their website or their mobile app.\n Thank you.`;
  }

  //select couriers
  else if (textArr.length === 2) {
    const data = couriers
      .map((courier, i) => {
        return `${i + 1} : ${courier} \n`;
      })
      .join(" ");

    const facilility = facilities.find(
      (f, i) => i === parseInt(text.split("*")[1]) - 1
    );
    orderData = { ...orderData, facilility: facilility.name };
    response = `CON Select preferred courier. \n ${data}`;
  }

  //enter delivery address
  else if (textArr.length === 3) {
    const courier = couriers.find(
      (c, i) => i === parseInt(text.split("*")[2]) - 1
    );
    orderData = { ...orderData, courier };
    response = `CON Enter delivery address. \n`;
  }

  //enter order deliver by date
  else if (textArr.length === 4) {
    orderData = { ...orderData, address: textArr[3] };
    response = `CON Enter latest delivery date. \n Format - (DD/MM/YYYY). \n`;
  }

  //enter order deliver by date
  else if (textArr.length === 5) {
    orderData = { ...orderData, deliveryDate: textArr[4] };
    response = `CON How long will this refill serve you? (in days). \n`;
  }

  //placing the order
  else if (textArr.length === 6) {
    orderData = { ...orderData, span: textArr[5], client: phoneNumber };
    const message = `Your order with orderID ${generateOrderId()} has been placed successfully. \n Awaiting delivery.`;
    sendMessage(message, phoneNumber);
    console.log(orderData);
    response = `END Your order has been placed successfully. Awaiting confirmation and delivery. \n`;
  }

  //invalid selection
  else {
    response = `END Invalid select option.`;
  }

  res.set("Content-Type: text/plain");
  res.send(response);
});

//send clinician verify code
app.post("/clinician/register", async (req, res) => {
  const { phone } = req.body;
  try {
    const token = jwt.sign({ phone }, "123456");
    const link = "http://localhost:5173/verify?token=" + token;
    const message = `You have been invited to be a clinician at Curecab. \n Click this link to get verified . \n\n ${link} `;
    sendMessage(message, phone);
    return res
      .status(200)
      .json({ msg: "Yoo have successfully added a new clinian." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: serror.message });
  }
});

//set clinician password
app.post("/clinician/verify", async (req, res) => {
  const { phone, password, token } = req.body;
  try {
    const decoded = jwt.verify(token, "123456");

    if (decoded.phone !== phone)
      return res.status(404).json({
        msg: "This token was not assigned to the phone number you provided.",
      });

    const hashedPassword = bcrypt.hashSync(password, 10);
    return res
      .status(200)
      .json({ msg: "Your account has been verified. Continue to login." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: error.message });
  }
});

//send message
app.post("/send-message", async (req, res) => {
  const { message, to } = req.body;
  try {
    sendMessage(message, to);
    return;
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
});

app.listen(5000, () => {
  console.log("Server started on port 5000");
});
