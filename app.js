const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("express-flash");

const app = express();
const PORT = process.env.PORT || 9000;
const TWO_HOURS = 1000 * 60 * 60 * 2;
const {
  NODE_ENV = "development",
  SESS_NAME = "name",
  SESS_SECRET = "secret",
  SESS_LIFETIME = TWO_HOURS,
} = process.env;
const IN_PROD = NODE_ENV === "production";

//middlewares
app.set("view engine", "ejs");
app.use(express.static("./public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(
  session({
    name: SESS_NAME,
    resave: false,
    saveUninitialized: false,
    secret: SESS_SECRET,
    cookie: {
      maxAge: SESS_LIFETIME,
      sameSite: true,
      secure: IN_PROD,
    },
  })
);

//routes
app.use("/", require("./routes/index.js"));

app.listen(PORT, () => {
  console.log(`Server listening at ${PORT}`);
});
