const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();
const db = new sqlite3.Database("./database.db");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: "zila_final",
  resave: false,
  saveUninitialized: true,
}));

app.set("view engine", "ejs");

// AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireOwner(req, res, next) {
  if (!req.session.user || req.session.user.role !== "owner") {
    return res.send("Unauthorized");
  }
  next();
}

// DATABASE
db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    password TEXT,
    role TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price INTEGER,
    category TEXT,
    description TEXT,
    image TEXT,
    stock INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    size TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    user TEXT,
    rating INTEGER,
    comment TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total INTEGER,
    status TEXT DEFAULT 'Pending'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_name TEXT,
    price INTEGER,
    quantity INTEGER,
    size TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT,
    discount INTEGER
  )`);

});

// HOME
app.get("/", (req, res) => {
  db.all("SELECT * FROM products", (e, products) => {
    res.render("index", { products });
  });
});

// SHOP
app.get("/shop", (req, res) => {
  const { search = "", category = "", min = 0, max = 999999 } = req.query;

  db.all(
    `SELECT * FROM products WHERE 
     name LIKE ? AND category LIKE ? AND price BETWEEN ? AND ?`,
    [`%${search}%`, `%${category}%`, min, max],
    (e, products) => res.render("shop", { products })
  );
});

// ✅ FINAL PRODUCT ROUTE (MERGED + FIXED)
app.get("/product/:id", (req, res) => {

  if (!req.session.recent) req.session.recent = [];

  req.session.recent.unshift(req.params.id);
  req.session.recent = [...new Set(req.session.recent)].slice(0, 5);

  db.get("SELECT * FROM products WHERE id=?", [req.params.id], (e, product) => {

    if (!product) return res.send("Product not found");

    db.all("SELECT * FROM variants WHERE product_id=?", [req.params.id], (e2, variants) => {

      db.all("SELECT * FROM reviews WHERE product_id=?", [req.params.id], (e3, reviews) => {

        let query = "";
        let params = [];

        if (req.session.recent.length > 0) {
          query = `SELECT * FROM products WHERE id IN (${req.session.recent.map(() => "?").join(",")})`;
          params = req.session.recent;
        } else {
          query = `SELECT * FROM products LIMIT 4`;
        }

        db.all(query, params, (e4, recentProducts) => {

          res.render("product", {
            product,
            variants,
            reviews,
            recentProducts
          });

        });

      });

    });

  });

});

// REVIEW
app.post("/add-review", requireLogin, (req, res) => {
  db.run(
    "INSERT INTO reviews VALUES (NULL,?,?,?,?)",
    [req.body.product_id, req.session.user.email, req.body.rating, req.body.comment],
    () => res.redirect("/product/" + req.body.product_id)
  );
});

// WISHLIST
app.post("/wishlist/:id", requireLogin, (req, res) => {
  db.run(
    "INSERT INTO wishlist VALUES (NULL,?,?)",
    [req.session.user.id, req.params.id],
    () => res.redirect("/wishlist")
  );
});

app.get("/wishlist", requireLogin, (req, res) => {
  db.all(`
    SELECT products.* FROM wishlist
    JOIN products ON products.id = wishlist.product_id
    WHERE wishlist.user_id=?`,
    [req.session.user.id],
    (e, items) => res.render("wishlist", { items })
  );
});

app.post("/remove-wishlist/:id", requireLogin, (req, res) => {
  db.run(
    "DELETE FROM wishlist WHERE product_id=? AND user_id=?",
    [req.params.id, req.session.user.id],
    () => res.redirect("/wishlist")
  );
});

// CART
app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];

  db.all("SELECT * FROM products ORDER BY RANDOM() LIMIT 4", (e, upsell) => {
    res.render("cart", { cart, upsell });
  });
});

app.post("/add-to-cart", (req, res) => {
  if (!req.session.cart) req.session.cart = [];

  req.session.cart.push({
    id: req.body.id,
    name: req.body.name,
    price: parseInt(req.body.price),
    size: req.body.size,
    qty: 1
  });

  res.redirect("/cart");
});

app.post("/remove-cart/:index", (req, res) => {
  req.session.cart.splice(req.params.index, 1);
  res.redirect("/cart");
});

// CHECKOUT
app.get("/checkout", requireLogin, (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  res.render("checkout", { cart, total, discount: 0 });
});

// ORDER
app.post("/place-order", requireLogin, (req, res) => {

  const cart = req.session.cart || [];
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  db.run(
    "INSERT INTO orders (user_id,total,status) VALUES (?,?,?)",
    [req.session.user.id, total, "Pending"],
    function () {

      const orderId = this.lastID;

      cart.forEach(i => {
        db.run(
          "INSERT INTO order_items VALUES (NULL,?,?,?,?,?)",
          [orderId, i.name, i.price, i.qty, i.size]
        );
      });

      req.session.cart = [];
      res.redirect("/invoice/" + orderId);
    }
  );
});

// INVOICE
app.get("/invoice/:id", requireLogin, (req, res) => {
  db.get("SELECT * FROM orders WHERE id=?", [req.params.id], (e, order) => {
    db.all("SELECT * FROM order_items WHERE order_id=?", [req.params.id], (e2, items) => {
      res.render("invoice", { order, items });
    });
  });
});

// OWNER
app.get("/owner", requireOwner, (req, res) => {
  db.all("SELECT * FROM products", (e, products) => {
    db.all("SELECT * FROM orders", (e2, orders) => {
      res.render("owner", { products, orders });
    });
  });
});

app.post("/add-product", requireOwner, (req, res) => {
  const { name, price, category, description, image, stock, sizes } = req.body;

  db.run(
    "INSERT INTO products VALUES (NULL,?,?,?,?,?,?)",
    [name, price, category, description, image, stock],
    function () {

      const id = this.lastID;

      sizes.split(",").forEach(s => {
        db.run("INSERT INTO variants VALUES (NULL,?,?)", [id, s.trim()]);
      });

      res.redirect("/owner");
    }
  );
});

app.post("/add-coupon", requireOwner, (req, res) => {
  db.run(
    "INSERT INTO coupons VALUES (NULL,?,?)",
    [req.body.code, req.body.discount],
    () => res.redirect("/owner")
  );
});

app.post("/update-order/:id", requireOwner, (req, res) => {
  db.run(
    "UPDATE orders SET status=? WHERE id=?",
    [req.body.status, req.params.id],
    () => res.redirect("/owner")
  );
});

// AUTH
app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
  db.get("SELECT * FROM users WHERE email=?", [req.body.email], async (e, u) => {
    if (u && await bcrypt.compare(req.body.password, u.password)) {
      req.session.user = u;
      res.redirect("/");
    } else res.send("Invalid");
  });
});

app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  db.run(
    "INSERT INTO users VALUES (NULL,?,?,?)",
    [req.body.email, hash, "customer"],
    () => res.redirect("/login")
  );
});

app.listen(3000, () => console.log("Zila FINAL SYSTEM RUNNING"));