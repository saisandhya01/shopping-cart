const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql");
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

//connecting to database
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345",
  database: "ecommerce",
});
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Mysql connected!");
});

//middlewares
app.set("view engine", "ejs");
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
//authenticating middleware function
function checkAuthenticated(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}
function checkNotAuthenticated(req, res, next) {
  if (req.session.user) {
    res.redirect("/home");
  } else {
    next();
  }
}

function checkForUsername(username) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM users WHERE username=?";
    db.query(sql, [username], (err, result) => {
      if (err) return reject(err);
      if (result[0]) {
        return resolve(username);
      } else {
        return resolve(null);
      }
    });
  });
}
function checkForEmail(email) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM users WHERE email=?";
    db.query(sql, [email], (err, result) => {
      if (err) return reject(err);
      if (result[0]) {
        return resolve(email);
      } else {
        return resolve(null);
      }
    });
  });
}

//routes
app.get("/", checkNotAuthenticated, (req, res) => {
  res.render("welcome");
});
app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login");
});
app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register");
});
app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const exists1 = await checkForUsername(req.body.username);
    const exists2 = await checkForEmail(req.body.email);
    if (!exists1 && !exists2) {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const user = {
        email: req.body.email,
        username: req.body.username,
        password: hashedPassword,
        usertype: req.body.usertype,
      };
      const sql = "INSERT INTO users SET ?";
      db.query(sql, user, (err, result) => {
        if (err) throw err;
        res.redirect("/login");
      });
    } else {
      req.flash(
        "exist",
        "Username or Email already exists. Try with a different one."
      );
      res.redirect("/register");
    }
  } catch (e) {
    console.log(e);
    res.redirect("/register");
  }
});
app.post("/login", checkNotAuthenticated, (req, res) => {
  try {
    const sql = "SELECT * FROM users WHERE email=?";
    db.query(sql, [req.body.email], async (err, rows) => {
      if (err) throw err;
      const user = rows[0];
      if (rows.length === 0) {
        req.flash("error", "No user with the given email found");
        res.redirect("/login");
      }
      if (await bcrypt.compare(req.body.password, user.password)) {
        req.session.user = user;
        if (user.usertype === "buyer") {
          res.redirect("/buyer/home");
        } else {
          res.redirect("/seller/home");
        }
      } else {
        req.flash("error", "Password incorrect!");
        res.redirect("/login");
      }
    });
  } catch (error) {
    console.log(error);
    res.redirect("/login");
  }
});

app.post("/logout", checkAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/home");
    }
    res.clearCookie(SESS_NAME);
    res.redirect("/login");
  });
});

app.get("/buyer/home", checkAuthenticated, (req, res) => {
  res.render("homeBuyer");
});
app.get("/seller/home", checkAuthenticated, (req, res) => {
  res.render("homeSeller");
});

app.listen(PORT, () => {
  console.log(`Server listening at ${PORT}`);
});
