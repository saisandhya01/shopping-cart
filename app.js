const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql");
const session = require("express-session");
const flash = require("express-flash");
const Joi = require("joi");
const multer = require("multer");
const path = require("path");

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
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).single("myImage");

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

const schema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).required(),
  password: Joi.string().min(4).required(),
});
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
    const value = await schema.validateAsync({
      email: req.body.email,
      username: req.body.username,
      password: req.body.password,
    });
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
      const userTypeUser = {
        username: req.body.username,
      };
      if (req.body.usertype === "buyer") {
        const sql1 = "INSERT INTO buyers SET ?";
        db.query(sql1, userTypeUser, (err, result) => {
          if (err) throw err;
        });
      } else {
        const sql1 = "INSERT INTO sellers SET ?";
        db.query(sql1, userTypeUser, (err, result) => {
          if (err) throw err;
        });
      }
    } else {
      req.flash(
        "exist",
        "Username or Email already exists. Try with a different one."
      );
      res.redirect("/register");
    }
  } catch (e) {
    if (e.isJoi === true) {
      req.flash(
        "exist",
        `Please provide valid credentials : ${e.details[0].message}`
      );
    }
    console.log(e);
    res.redirect("/register");
  }
});
app.post("/login", checkNotAuthenticated, async (req, res) => {
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
app.get("/addItem", checkAuthenticated, (req, res) => {
  res.render("addItem");
});
app.post("/addItem", checkAuthenticated, (req, res) => {
  const item = {
    name: req.body.name,
    description: req.body.description,
    quantity: req.body.quantity,
    price: req.body.price,
    soldBy: req.session.user.username,
  };
  const sql = "INSERT INTO items SET ?";
  db.query(sql, item, (err, result) => {
    if (err) throw err;
  });
  //successfully added row

  //to get the id of last added row
  const sql1 = "SELECT id FROM items ORDER BY id DESC LIMIT 1";
  db.query(sql1, (err, result) => {
    if (err) throw err;
    res.redirect(`/addimg/${result[0].id}`);
  });
});
app.get("/addimg/:id", checkAuthenticated, (req, res) => {
  //should render only for the user who added the item
  const sql = "SELECT * FROM items WHERE id=? AND soldBy=?";
  db.query(sql, [req.params.id, req.session.user.username], (err, result) => {
    if (err) throw err;
    if (result.length !== 0) {
      res.render("imageItemUpload", { id: req.params.id });
    } else {
      res.redirect("/seller/home");
    }
  });
});

app.post("/addimg/:id", checkAuthenticated, (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.render(`imageItemUpload`, { msg: err, id: req.params.id });
    } else {
      if (req.file == undefined) {
        //try using flash here
        res.render(`imageItemUpload`, {
          msg: "Error: No File Selected!",
          id: req.params.id,
        });
      } else {
        const sql = "UPDATE items SET image=? WHERE id=? AND soldBy=?";
        db.query(
          sql,
          [req.file.filename, req.params.id, req.session.user.username],
          (err, result) => {
            if (err) {
              throw err;
            }
            res.redirect("/seller/home");
          }
        );
      }
    }
  });
});

app.get("/seller/items", checkAuthenticated, (req, res) => {
  const sql = "SELECT * FROM items WHERE soldBy=?";
  db.query(sql, [req.session.user.username], (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});
app.get("/seller/update/:id", checkAuthenticated, (req, res) => {
  //update the item which is added only by the logged in user
  const sql = "SELECT * FROM items WHERE id=? AND soldBy=?";
  db.query(sql, [req.params.id, req.session.user.username], (err, result) => {
    if (err) throw err;
    if (result.length !== 0) {
      res.render("updateItems", { id: req.params.id });
    } else {
      res.redirect("/seller/home");
    }
  });
});
app.post("/seller/update/:id", checkAuthenticated, (req, res) => {
  const sql = `UPDATE items SET ? WHERE id=${req.params.id}`;
  db.query(sql, req.body, (err, result) => {
    if (err) throw err;
  });
  res.redirect("/seller/home");
});
app.get("/seller/item/:id", checkAuthenticated, (req, res) => {
  const sql = "SELECT * FROM items WHERE id=?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});
app.get("/buyer/items", checkAuthenticated, (req, res) => {
  const sql = "SELECT * FROM items";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});
app.get("/buyer/item/:id", checkAuthenticated, (req, res) => {
  const sql = "SELECT * FROM items WHERE id=?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});
app.get("/buyer/cart", checkAuthenticated, (req, res) => {
  const sql = "SELECT cart FROM buyers WHERE username=?";
  db.query(sql, [req.session.user.username], (err, result) => {
    if (err) throw err;
    if (result[0].cart === "") {
      res.send([]);
    } else {
      res.send(JSON.parse(result[0].cart));
    }
  });
});
app.post("/buyer/addToCart", checkAuthenticated, (req, res) => {
  const itemDetails = req.body;
  const stringifiedItem = JSON.stringify(itemDetails.cart);
  const sql = "UPDATE buyers SET cart=? WHERE username=?";
  db.query(sql, [stringifiedItem, req.session.user.username], (err, result) => {
    if (err) throw err;
    console.log("Added to cart", result);
  });
});
app.get("/buyer/showCart", checkAuthenticated, (req, res) => {
  res.render("buyerCart");
});
app.get("/buyer/orders", checkAuthenticated, (req, res) => {
  res.render("buyerOrders");
});
app.post("/buyer/order", checkAuthenticated, (req, res) => {
  const id = req.body.id;
  const quantity = req.body.quantity;
  //reduce the quantity of the item by 1
  const sql = `UPDATE items SET quantity=quantity-${quantity} WHERE id=${id}`;
  db.query(sql, (err, result) => {
    if (err) throw err;
  });
  //add item to buyer's purchases
  const object = {
    id: id,
    quantity: quantity,
    date: new Date(),
    buyerName: req.session.user.username,
    buyerEmail: req.session.user.email,
  };
  let array = [];
  const sql1 = "SELECT purchases FROM buyers WHERE username=?";
  db.query(sql1, [req.session.user.username], (err, result) => {
    if (err) throw err;
    if (result[0].purchases === "") {
      array.push(object);
    } else {
      array = JSON.parse(result[0].purchases);
      array.push(object);
    }
    const sql2 = "UPDATE buyers SET purchases=? WHERE username=?";
    db.query(
      sql2,
      [JSON.stringify(array), req.session.user.username],
      (err, result1) => {
        if (err) throw err;
        //console.log(result1);
      }
    );
  });

  //add item to seller database
  const SQL = `SELECT soldBy FROM items WHERE id=${id}`;
  db.query(SQL, (err, result) => {
    if (err) throw err;
    let sellerName = result[0].soldBy;
    let array = [];
    const SQL1 = "SELECT orders FROM sellers WHERE username=?";
    db.query(SQL1, [sellerName], (err, result) => {
      if (err) throw err;
      if (result[0].orders === "") {
        array.push(object);
      } else {
        array = JSON.parse(result[0].orders);
        array.push(object);
      }
      const SQL2 = "UPDATE sellers SET orders=? WHERE username=?";
      db.query(SQL2, [JSON.stringify(array), sellerName], (err, result1) => {
        if (err) throw err;
        console.log(result1);
      });
    });
  });
});
app.listen(PORT, () => {
  console.log(`Server listening at ${PORT}`);
});
