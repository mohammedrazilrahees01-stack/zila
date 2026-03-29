require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();


// ─── DATABASE SETUP ────────────────────────────────────────────────────────────
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) { console.error('DB Error:', err); process.exit(1); }
  console.log('✅ Database connected');
});

// Enable WAL mode and foreign keys
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    role TEXT DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    offer_price REAL DEFAULT 0,
    image TEXT NOT NULL,
    category TEXT DEFAULT 'Topwear',
    stock INTEGER DEFAULT 0,
    featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    size TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Pending Verification',
    payment_ref TEXT,
    shipping_name TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_pincode TEXT,
    cancel_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  // ✅ ADD THIS LINE HERE
  db.run(`DELETE FROM users WHERE role = 'owner'`, (err) => {
    if (!err) console.log("🧹 Old owner deleted");
  });
  
  console.log('✅ Database tables ready');
});

// ─── DB HELPER WRAPPERS ────────────────────────────────────────────────────────
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes }); });
});

// ─── MULTER ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './public/images';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|webp|gif/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'zila-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce((s, i) => s + (i.qty || 0), 0);
  res.locals.user = req.session.user || null;
  next();
});

// ─── AUTH GUARDS ────────────────────────────────────────────────────────────────
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};
const isOwner = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'owner') return res.redirect('/');
  next();
};

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const sanitize = (str) => String(str || '').replace(/[<>'"]/g, '').trim();

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// HOME
app.get('/', async (req, res) => { /* SEO:home */
  try {
    const products = await dbAll(`SELECT * FROM products WHERE stock > 0 ORDER BY created_at DESC LIMIT 8`);
    res.render('index', { products,
      pageTitle: 'Zila Collections | Premium Streetwear – Kannur, Kerala',
      pageDesc: 'Shop premium streetwear & trending fashion at Zila Collections. Exclusive hoodies, tees & drops. Based in Kannur, Kerala. Fast delivery across India.',
      pageCanonical: 'https://zilacollections.com/',
      ogType: 'website',
      jsonLd: { '@context':'https://schema.org','@type':'ClothingStore','name':'Zila Collections','url':'https://zilacollections.com','logo':'https://zilacollections.com/images/zila.png','description':'Premium streetwear from Kannur, Kerala','address':{'@type':'PostalAddress','addressLocality':'Kannur','addressRegion':'Kerala','addressCountry':'IN'},'telephone':'+918075437816','email':'zilacollections@gmail.com','sameAs':['https://instagram.com/zilacollections','https://wa.me/918075437816'] }
    });
  } catch (err) {
    console.error(err);
    res.render('index', { products: [],
      pageTitle: 'Zila Collections | Premium Streetwear – Kannur, Kerala',
      pageDesc: 'Shop premium streetwear & trending fashion at Zila Collections.',
      pageCanonical: 'https://zilacollections.com/'
    });
  }
});

// SHOP
app.get('/shop', async (req, res) => {
  try {
    const { search = '', category = '', sort = 'newest', min = 0, max = 999999 } = req.query;
    let sql = `SELECT * FROM products WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ` AND (name LIKE ? OR description LIKE ? OR category LIKE ?)`;
      const s = `%${sanitize(search)}%`;
      params.push(s, s, s);
    }
    if (category) { sql += ` AND category = ?`; params.push(sanitize(category)); }
    sql += ` AND (CASE WHEN offer_price > 0 AND offer_price < price THEN offer_price ELSE price END) >= ?`;
    params.push(Number(min) || 0);
    sql += ` AND (CASE WHEN offer_price > 0 AND offer_price < price THEN offer_price ELSE price END) <= ?`;
    params.push(Number(max) || 999999);
    const sortMap = {
      newest: 'created_at DESC',
      price_asc: '(CASE WHEN offer_price > 0 AND offer_price < price THEN offer_price ELSE price END) ASC',
      price_desc: '(CASE WHEN offer_price > 0 AND offer_price < price THEN offer_price ELSE price END) DESC'
    };
    sql += ` ORDER BY ${sortMap[sort] || 'created_at DESC'}`;
    const products = await dbAll(sql, params);
    const categories = await dbAll(`SELECT DISTINCT category FROM products ORDER BY category`);
    res.render('shop', { products, categories, search, currentCategory: category, currentSort: sort, min: Number(min) || 0, max: Number(max) || 999999,
      pageTitle: 'Shop – Zila Collections | Streetwear & Fashion',
      pageDesc: 'Browse our full collection of premium streetwear, hoodies, tees & more at Zila Collections. New drops added regularly.',
      pageCanonical: 'https://zilacollections.com/shop',
      pageKeywords: 'shop streetwear, buy hoodies Kerala, fashion online India, Zila Collections shop'
    });
  } catch (err) {
    console.error(err);
    res.render('shop', { products: [], categories: [], search: '', currentCategory: '', currentSort: 'newest', min: 0, max: 999999,
      pageTitle: 'Shop – Zila Collections | Streetwear & Fashion',
      pageDesc: 'Browse our full collection of premium streetwear at Zila Collections.',
      pageCanonical: 'https://zilacollections.com/shop'
    });
  }
});

// PRODUCT DETAIL
app.get('/product/:id', async (req, res) => {
  try {
    const product = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!product) return res.redirect('/shop');
    const variants = await dbAll(`SELECT * FROM variants WHERE product_id = ?`, [product.id]);
    const reviews = await dbAll(`
      SELECT r.*, u.name as user_name
      FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? ORDER BY r.created_at DESC
    `, [product.id]);
    const related = await dbAll(`SELECT * FROM products WHERE category = ? AND id != ? AND stock > 0 LIMIT 4`, [product.category, product.id]);
    let inWishlist = false;
    if (req.session.user) {
      const wish = await dbGet(`SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?`, [req.session.user.id, product.id]);
      inWishlist = !!wish;
    }
    if (!req.session.recentlyViewed) req.session.recentlyViewed = [];
    req.session.recentlyViewed = [product.id, ...req.session.recentlyViewed.filter(id => id !== product.id)].slice(0, 10);
    res.render('product', { product, variants, reviews, related, inWishlist, user: req.session.user,
      pageTitle: (product.name || 'Product') + ' – Zila Collections',
      pageDesc: (product.description ? product.description.substring(0,150) : product.name) + ' – Shop at Zila Collections, Kannur Kerala.',
      pageCanonical: 'https://zilacollections.com/product/' + product.id,
      ogType: 'product',
      ogImage: product.image ? 'https://zilacollections.com/' + product.image : 'https://zilacollections.com/images/zila.png',
      pageKeywords: (product.name || '') + ', streetwear, fashion Kerala, Zila Collections',
      jsonLd: { '@context':'https://schema.org','@type':'Product','name': product.name,'description': product.description || product.name,'image': product.image ? 'https://zilacollections.com/' + product.image : 'https://zilacollections.com/images/zila.png','brand':{'@type':'Brand','name':'Zila Collections'},'offers':{'@type':'Offer','price': product.price,'priceCurrency':'INR','availability':'https://schema.org/InStock','url':'https://zilacollections.com/product/' + product.id} }
    });
  } catch (err) {
    console.error(err);
    res.redirect('/shop');
  }
});

// ─── CART ─────────────────────────────────────────────────────────────────────
app.post('/cart', async (req, res) => {
  const { productId, size } = req.body;
  if (!productId) return res.redirect('/shop');
  try {
    const product = await dbGet(`SELECT * FROM products WHERE id = ?`, [productId]);
    if (!product || product.stock <= 0) return res.redirect(`/product/${productId}`);
    if (!req.session.cart) req.session.cart = [];
    const cart = req.session.cart;
    const existingIdx = cart.findIndex(i => String(i.productId) === String(productId) && i.size === (size || 'Free Size'));
    if (existingIdx >= 0) {
      cart[existingIdx].qty = Math.min(cart[existingIdx].qty + 1, product.stock);
    } else {
      const price = (product.offer_price && product.offer_price > 0 && product.offer_price < product.price) ? product.offer_price : product.price;
      cart.push({ productId: product.id, name: product.name, price, image: product.image, size: size || 'Free Size', qty: 1 });
    }
    res.redirect('/cart?added=1');
  } catch (err) {
    console.error(err);
    res.redirect('/shop');
  }
});

app.get('/cart', async (req, res) => {
  const cart = req.session.cart || [];
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  let upsell = [];
  try {
    if (cart.length > 0) {
      const ids = cart.map(i => i.productId);
      const placeholders = ids.map(() => '?').join(',');
      upsell = await dbAll(`SELECT * FROM products WHERE id NOT IN (${placeholders}) AND stock > 0 ORDER BY RANDOM() LIMIT 4`, ids);
    }
  } catch (err) { console.error(err); }
  res.render('cart', { pageTitle: 'Your Cart – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'Your Cart – Zila Collections', pageRobots: 'noindex, nofollow', cart, cartTotal, upsell });
});

app.post('/cart/update/:index', async (req, res) => {
  const idx = parseInt(req.params.index);
  const qty = parseInt(req.body.qty);
  if (!req.session.cart) return res.redirect('/cart');
  if (qty <= 0) {
    req.session.cart.splice(idx, 1);
  } else {
    const item = req.session.cart[idx];
    if (item) {
      try {
        const product = await dbGet(`SELECT stock FROM products WHERE id = ?`, [item.productId]);
        req.session.cart[idx].qty = Math.min(qty, product ? product.stock : qty);
      } catch { req.session.cart[idx].qty = qty; }
    }
  }
  res.redirect('/cart');
});

app.post('/remove-cart/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  if (req.session.cart && req.session.cart[idx] !== undefined) req.session.cart.splice(idx, 1);
  res.redirect('/cart');
});

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────
app.get('/checkout', isAuthenticated, async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = cartTotal >= 1999 ? 0 : 99;
  const total = cartTotal + shipping;
  try {
    const userData = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.session.user.id]) || {};
    res.render('checkout', { pageTitle: 'Checkout – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'Checkout – Zila Collections', pageRobots: 'noindex, nofollow', cart, total, userData });
  } catch (err) {
    res.render('checkout', { pageTitle: 'Checkout – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'Checkout – Zila Collections', pageRobots: 'noindex, nofollow', cart, total, userData: {} });
  }
});

app.post('/checkout', isAuthenticated, async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');
  const { name, phone, address, city, pincode, payment_ref } = req.body;
  if (!name || !phone || !address || !city || !pincode || !payment_ref) return res.redirect('/checkout?error=1');
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = cartTotal >= 1999 ? 0 : 99;
  const total = cartTotal + shipping;
  try {
    const result = await dbRun(
      `INSERT INTO orders (user_id, items, total, payment_ref, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_pincode, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification')`,
      [req.session.user.id, JSON.stringify(cart), total, sanitize(payment_ref), sanitize(name), sanitize(phone), sanitize(address), sanitize(city), sanitize(pincode)]
    );
    await dbRun(`UPDATE users SET name=?, phone=?, address=?, city=?, pincode=? WHERE id=?`,
      [sanitize(name), sanitize(phone), sanitize(address), sanitize(city), sanitize(pincode), req.session.user.id]);
    req.session.cart = [];
    res.redirect(`/orders/${result.lastID}`);
  } catch (err) {
    console.error(err);
    res.redirect('/checkout?error=1');
  }
});

// ─── ORDERS ────────────────────────────────────────────────────────────────────
app.get('/orders', isAuthenticated, async (req, res) => {
  try {
    const orders = await dbAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [req.session.user.id]);
    res.render('orders', { pageTitle: 'My Orders – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'My Orders – Zila Collections', pageRobots: 'noindex, nofollow', orders });
  } catch (err) { res.render('orders', { pageTitle: 'My Orders – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'My Orders – Zila Collections', pageRobots: 'noindex, nofollow', orders: [] }); }
});

app.get('/orders/:id', isAuthenticated, async (req, res) => {
  try {
    const order = await dbGet(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [req.params.id, req.session.user.id]);
    if (!order) return res.redirect('/orders');
    res.render('order-details', { pageTitle: 'Order Details – Zila Collections', pageRobots: 'noindex, nofollow', order });
  } catch { res.redirect('/orders'); }
});

// ─── ACCOUNT ──────────────────────────────────────────────────────────────────
app.get('/account', isAuthenticated, async (req, res) => {
  try {
    const userData = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.session.user.id]);
    const recentOrders = await dbAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [req.session.user.id]);
    res.render('account', { pageTitle: 'My Account – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'My Account – Zila Collections', pageRobots: 'noindex, nofollow', userData, recentOrders, error: req.query.error || null });
  } catch (err) { res.render('account', { pageTitle: 'My Account – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'My Account – Zila Collections', pageRobots: 'noindex, nofollow', userData: {}, recentOrders: [], error: null }); }
});

app.post('/account/update', isAuthenticated, async (req, res) => {
  const { name, phone, address, city, pincode } = req.body;
  await dbRun(`UPDATE users SET name=?, phone=?, address=?, city=?, pincode=? WHERE id=?`,
    [sanitize(name), sanitize(phone), sanitize(address), sanitize(city), sanitize(pincode), req.session.user.id]);
  req.session.user.name = sanitize(name);
  res.redirect('/account?updated=1');
});

app.post('/account/change-password', isAuthenticated, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.session.user.id]);
    const match = await bcrypt.compare(current_password, user.password);
    if (!match) return res.redirect('/account?error=wrong_password');
    const hashed = await bcrypt.hash(new_password, 12);
    await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [hashed, req.session.user.id]);
    res.redirect('/account?updated=1');
  } catch { res.redirect('/account?error=1'); }
});

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
app.get('/wishlist', isAuthenticated, async (req, res) => {
  try {
    const wishlist = await dbAll(`
      SELECT p.* FROM products p
      INNER JOIN wishlist w ON p.id = w.product_id
      WHERE w.user_id = ?
    `, [req.session.user.id]);
    res.render('wishlist', { pageTitle: 'My Wishlist – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'My Wishlist – Zila Collections', pageRobots: 'noindex, nofollow', wishlist });
  } catch { res.render('wishlist', { pageTitle: 'My Wishlist – Zila Collections', pageRobots: 'noindex, nofollow', pageTitle: 'My Wishlist – Zila Collections', pageRobots: 'noindex, nofollow', wishlist: [] }); }
});

app.post('/add-wishlist/:id', isAuthenticated, async (req, res) => {
  try {
    await dbRun(`INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)`, [req.session.user.id, req.params.id]);
    res.redirect(`/product/${req.params.id}?wishlisted=1`);
  } catch { res.redirect(`/product/${req.params.id}`); }
});

app.post('/remove-wishlist/:id', isAuthenticated, async (req, res) => {
  await dbRun(`DELETE FROM wishlist WHERE user_id = ? AND product_id = ?`, [req.session.user.id, req.params.id]);
  res.redirect(req.headers.referer || '/wishlist');
});

// ─── REVIEWS ──────────────────────────────────────────────────────────────────
app.post('/add-review', isAuthenticated, async (req, res) => {
  const { product_id, rating, comment } = req.body;
  if (!product_id || !rating || !comment) return res.redirect('back');
  try {
    const existing = await dbGet(`SELECT 1 FROM reviews WHERE user_id = ? AND product_id = ?`, [req.session.user.id, product_id]);
    if (existing) {
      await dbRun(`UPDATE reviews SET rating=?, comment=?, created_at=CURRENT_TIMESTAMP WHERE user_id=? AND product_id=?`,
        [parseInt(rating), sanitize(comment), req.session.user.id, product_id]);
    } else {
      await dbRun(`INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)`,
        [product_id, req.session.user.id, parseInt(rating), sanitize(comment)]);
    }
    res.redirect(`/product/${product_id}?reviewed=1`);
  } catch (err) {
    console.error(err);
    res.redirect(`/product/${product_id}`);
  }
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => { /* SEO:login */
  if (req.session.user) return res.redirect(req.session.user.role === 'owner' ? '/owner' : '/');
  res.render('login', { error: null,
      pageTitle: 'Login – Zila Collections',
      pageDesc: 'Sign in to your Zila Collections account to track orders, manage wishlist and more.',
      pageCanonical: 'https://zilacollections.com/login',
      pageRobots: 'noindex, nofollow'
    });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('login', { error: 'Please fill in all fields.' });
  try {
    const user = await dbGet(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (!user) return res.render('login', { error: 'No account found with this email.' });
    // Prevent customer login route from being used by owner — owner must use hidden route
    if (user.role === 'owner') return res.render('login', { error: 'Invalid credentials.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Incorrect password.' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

app.get('/register', (req, res) => { /* SEO:register */
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null,
      pageTitle: 'Create Account – Zila Collections',
      pageDesc: 'Join Zila Collections. Create your account for exclusive deals, order tracking and wishlist.',
      pageCanonical: 'https://zilacollections.com/register',
      pageRobots: 'noindex, nofollow'
    });
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.render('register', { error: 'All fields are required.' });
  if (password.length < 6) return res.render('register', { error: 'Password must be at least 6 characters.' });
  try {
    const existing = await dbGet(`SELECT 1 FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (existing) return res.render('register', { error: 'An account with this email already exists.' });
    const hashed = await bcrypt.hash(password, 12);
    const result = await dbRun(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')`,
      [sanitize(name), email.toLowerCase().trim(), hashed]);
    req.session.user = { id: result.lastID, name: sanitize(name), email: email.toLowerCase().trim(), role: 'customer' };
    res.redirect('/?registered=1');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Registration failed. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ─── HIDDEN OWNER LOGIN ────────────────────────────────────────────────────────
const OWNER_ROUTE = process.env.OWNER_LOGIN_ROUTE || '/admin-access-zila-2024';

app.get(OWNER_ROUTE, (req, res) => {
  if (req.session.user && req.session.user.role === 'owner') return res.redirect('/owner');
  res.render('owner-login', { error: null, loginRoute: OWNER_ROUTE + '/auth' });
});

app.post(OWNER_ROUTE + '/auth', async (req, res) => {
  const { email, password } = req.body;
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    return res.render('owner-login', { error: 'Owner credentials not configured in .env', loginRoute: OWNER_ROUTE + '/auth' });
  }
  if (email.toLowerCase().trim() !== ownerEmail.toLowerCase().trim()) {
    return res.render('owner-login', { error: 'Invalid credentials.', loginRoute: OWNER_ROUTE + '/auth' });
  }
  try {
    let ownerUser = await dbGet(`SELECT * FROM users WHERE email = ? AND role = 'owner'`, [ownerEmail]);
    if (!ownerUser) {
      const hashed = await bcrypt.hash(ownerPassword, 12);
      const result = await dbRun(`INSERT INTO users (name, email, password, role) VALUES ('Owner', ?, ?, 'owner')`, [ownerEmail, hashed]);
      ownerUser = await dbGet(`SELECT * FROM users WHERE id = ?`, [result.lastID]);
    }
    const match = await bcrypt.compare(password, ownerUser.password);
    const plainMatch = password.trim() === ownerPassword.trim();
    if (!match && !plainMatch) {
      return res.render('owner-login', { error: 'Invalid credentials.', loginRoute: OWNER_ROUTE + '/auth' });
    }
    if (!match && plainMatch) {
      const hashed = await bcrypt.hash(ownerPassword, 12);
      await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [hashed, ownerUser.id]);
    }
    req.session.user = { id: ownerUser.id, name: 'Owner', email: ownerUser.email, role: 'owner' };
    res.redirect('/owner');
  } catch (err) {
    console.error(err);
    res.render('owner-login', { error: 'Login failed.', loginRoute: OWNER_ROUTE + '/auth' });
  }
});

// ─── STATIC PAGES ────────────────────────────────────────────────────────────
app.get('/contact', (req, res) => res.render('contact', {
      pageTitle: 'Contact Us – Zila Collections | Kannur, Kerala',
      pageDesc: 'Get in touch with Zila Collections. WhatsApp: +91 80754 37816 | Email: zilacollections@gmail.com | Based in Kannur, Kerala, India.',
      pageCanonical: 'https://zilacollections.com/contact',
      pageKeywords: 'Zila Collections contact, Kannur fashion shop, WhatsApp order fashion Kerala',
      jsonLd: { '@context':'https://schema.org','@type':'ContactPage','name':'Contact Zila Collections','url':'https://zilacollections.com/contact','mainEntity':{'@type':'ClothingStore','name':'Zila Collections','telephone':'+918075437816','email':'zilacollections@gmail.com','address':{'@type':'PostalAddress','addressLocality':'Kannur','addressRegion':'Kerala','addressCountry':'IN'}} }
    }));

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// DASHBOARD
app.get('/owner', isOwner, async (req, res) => {
  try {
    const [totalRevenue, totalOrders, newOrders, totalCustomers, totalProducts, pendingCount, approvedCount, shippedCount, deliveredCount, cancelledCount] = await Promise.all([
      dbGet(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE status != 'Cancelled'`),
      dbGet(`SELECT COUNT(*) as v FROM orders`),
      dbGet(`SELECT COUNT(*) as v FROM orders WHERE date(created_at) = date('now')`),
      dbGet(`SELECT COUNT(*) as v FROM users WHERE role = 'customer'`),
      dbGet(`SELECT COUNT(*) as v FROM products`),
      dbGet(`SELECT COUNT(*) as v FROM orders WHERE status = 'Pending Verification'`),
      dbGet(`SELECT COUNT(*) as v FROM orders WHERE status = 'Approved'`),
      dbGet(`SELECT COUNT(*) as v FROM orders WHERE status = 'Shipped'`),
      dbGet(`SELECT COUNT(*) as v FROM orders WHERE status = 'Delivered'`),
      dbGet(`SELECT COUNT(*) as v FROM orders WHERE status = 'Cancelled'`),
    ]);
    const stats = {
      totalRevenue: totalRevenue.v, totalOrders: totalOrders.v, newOrders: newOrders.v,
      totalCustomers: totalCustomers.v, totalProducts: totalProducts.v,
      pendingCount: pendingCount.v, approvedCount: approvedCount.v,
      shippedCount: shippedCount.v, deliveredCount: deliveredCount.v, cancelledCount: cancelledCount.v
    };
    const [pendingOrders, recentOrders, lowStockProducts] = await Promise.all([
      dbAll(`SELECT * FROM orders WHERE status = 'Pending Verification' ORDER BY created_at DESC`),
      dbAll(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 8`),
      dbAll(`SELECT * FROM products WHERE stock <= 5 AND stock >= 0 ORDER BY stock ASC LIMIT 5`),
    ]);
    res.render('owner-dashboard', { stats, pendingOrders, recentOrders, lowStockProducts });
  } catch (err) {
    console.error(err);
    res.render('owner-dashboard', { stats: {}, pendingOrders: [], recentOrders: [], lowStockProducts: [] });
  }
});

// PRODUCTS
app.get('/owner/products', isOwner, async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;
    let sql = `SELECT * FROM products WHERE 1=1`;
    const params = [];
    if (search) { sql += ` AND name LIKE ?`; params.push(`%${search}%`); }
    if (category) { sql += ` AND category = ?`; params.push(category); }
    sql += ` ORDER BY created_at DESC`;
    const products = await dbAll(sql, params);
    res.render('owner-products', { products, search, currentCategory: category });
  } catch { res.render('owner-products', { products: [], search: '', currentCategory: '' }); }
});

app.get('/owner/products/add', isOwner, (req, res) => res.render('add-product', { error: null }));

app.post('/add-product', isOwner, upload.single('image'), async (req, res) => {
  const { name, description, price, offer_price, stock, category, featured } = req.body;
  const sizes = req.body['size[]'] ? (Array.isArray(req.body['size[]']) ? req.body['size[]'] : [req.body['size[]']]) : [];
  const variantStocks = req.body['variant_stock[]'] ? (Array.isArray(req.body['variant_stock[]']) ? req.body['variant_stock[]'] : [req.body['variant_stock[]']]) : [];
  if (!req.file) return res.render('add-product', { error: 'Please upload a product image.' });
  if (!name || !price) return res.render('add-product', { error: 'Name and price are required.' });
  try {
    const result = await dbRun(
      `INSERT INTO products (name, description, price, offer_price, image, category, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sanitize(name), sanitize(description), parseFloat(price)||0, parseFloat(offer_price)||0, req.file.filename, sanitize(category)||'Topwear', parseInt(stock)||0, featured?1:0]
    );
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i]?.trim()) await dbRun(`INSERT INTO variants (product_id, size, stock) VALUES (?, ?, ?)`, [result.lastID, sizes[i].trim(), parseInt(variantStocks[i])||0]);
    }
    res.redirect('/owner/products');
  } catch (err) {
    console.error(err);
    res.render('add-product', { error: 'Failed to add product. ' + err.message });
  }
});

app.get('/owner/products/edit/:id', isOwner, async (req, res) => {
  try {
    const product = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!product) return res.redirect('/owner/products');
    const variants = await dbAll(`SELECT * FROM variants WHERE product_id = ?`, [product.id]);
    res.render('edit-product', { product, variants, error: null });
  } catch { res.redirect('/owner/products'); }
});

app.post('/owner/products/edit/:id', isOwner, upload.single('image'), async (req, res) => {
  const { name, description, price, offer_price, stock, category, featured } = req.body;
  const sizes = req.body['size[]'] ? (Array.isArray(req.body['size[]']) ? req.body['size[]'] : [req.body['size[]']]) : [];
  const variantStocks = req.body['variant_stock[]'] ? (Array.isArray(req.body['variant_stock[]']) ? req.body['variant_stock[]'] : [req.body['variant_stock[]']]) : [];
  try {
    const existing = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!existing) return res.redirect('/owner/products');
    const image = req.file ? req.file.filename : existing.image;
    await dbRun(
      `UPDATE products SET name=?, description=?, price=?, offer_price=?, image=?, category=?, stock=?, featured=? WHERE id=?`,
      [sanitize(name), sanitize(description), parseFloat(price)||0, parseFloat(offer_price)||0, image, sanitize(category), parseInt(stock)||0, featured?1:0, req.params.id]
    );
    await dbRun(`DELETE FROM variants WHERE product_id = ?`, [req.params.id]);
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i]?.trim()) await dbRun(`INSERT INTO variants (product_id, size, stock) VALUES (?, ?, ?)`, [req.params.id, sizes[i].trim(), parseInt(variantStocks[i])||0]);
    }
    res.redirect('/owner/products');
  } catch (err) {
    console.error(err);
    res.redirect('/owner/products/edit/' + req.params.id + '?error=1');
  }
});

app.post('/delete-product/:id', isOwner, async (req, res) => {
  try {
    await dbRun(`DELETE FROM variants WHERE product_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM products WHERE id = ?`, [req.params.id]);
  } catch (err) { console.error(err); }
  res.redirect('/owner/products');
});

// ORDERS (Owner)
app.get('/owner/orders', isOwner, async (req, res) => {
  try {
    const { status = '' } = req.query;
    let orders;
    if (status && status !== 'All') {
      orders = await dbAll(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC`, [status]);
    } else {
      orders = await dbAll(`SELECT * FROM orders ORDER BY created_at DESC`);
    }
    res.render('owner-orders', { orders, currentStatus: status || 'All' });
  } catch { res.render('owner-orders', { orders: [], currentStatus: 'All' }); }
});

app.get('/owner/orders/:id', isOwner, async (req, res) => {
  try {
    const order = await dbGet(`
      SELECT o.*, u.email as user_email FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [req.params.id]);
    if (!order) return res.redirect('/owner/orders');
    res.render('owner-order-details', { order });
  } catch { res.redirect('/owner/orders'); }
});

app.post('/owner/orders/:id/status', isOwner, async (req, res) => {
  const { status, cancel_reason } = req.body;
  const validStatuses = ['Pending Verification', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) return res.redirect('/owner/orders/' + req.params.id);
  try {
    if (status === 'Cancelled') {
      await dbRun(`UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?`, [status, sanitize(cancel_reason||''), req.params.id]);
    } else {
      await dbRun(`UPDATE orders SET status = ?, cancel_reason = NULL WHERE id = ?`, [status, req.params.id]);
    }
  } catch (err) { console.error(err); }
  res.redirect('/owner/orders/' + req.params.id);
});

// CUSTOMERS
app.get('/owner/customers', isOwner, async (req, res) => {
  try {
    const { search = '' } = req.query;
    let customers;
    if (search) {
      customers = await dbAll(`
        SELECT u.*, COUNT(o.id) as order_count, COALESCE(SUM(o.total), 0) as total_spent
        FROM users u LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.role = 'customer' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
        GROUP BY u.id ORDER BY u.created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      customers = await dbAll(`
        SELECT u.*, COUNT(o.id) as order_count, COALESCE(SUM(o.total), 0) as total_spent
        FROM users u LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.role = 'customer'
        GROUP BY u.id ORDER BY u.created_at DESC
      `);
    }
    res.render('owner-customers', { customers, search });
  } catch { res.render('owner-customers', { customers: [], search: '' }); }
});

app.get('/owner/customers/:id', isOwner, async (req, res) => {
  try {
    const customer = await dbGet(`SELECT * FROM users WHERE id = ? AND role = 'customer'`, [req.params.id]);
    if (!customer) return res.redirect('/owner/customers');
    const [customerOrders, wishlistCountRow] = await Promise.all([
      dbAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [req.params.id]),
      dbGet(`SELECT COUNT(*) as v FROM wishlist WHERE user_id = ?`, [req.params.id])
    ]);
    res.render('owner-customer-details', { customer, customerOrders, wishlistCount: wishlistCountRow.v });
  } catch { res.redirect('/owner/customers'); }
});

// REVIEWS
app.get('/owner/reviews', isOwner, async (req, res) => {
  try {
    const reviews = await dbAll(`
      SELECT r.*, u.name as user_name, p.name as product_name
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN products p ON r.product_id = p.id
      ORDER BY r.created_at DESC
    `);
    res.render('owner-reviews', { reviews });
  } catch { res.render('owner-reviews', { reviews: [] }); }
});

app.post('/owner/reviews/delete/:id', isOwner, async (req, res) => {
  await dbRun(`DELETE FROM reviews WHERE id = ?`, [req.params.id]);
  res.redirect('/owner/reviews');
});

// ANALYTICS
app.get('/owner/analytics', isOwner, async (req, res) => {
  try {
    const [totalRevRow, totalOrdRow, totalCustRow] = await Promise.all([
      dbGet(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE status != 'Cancelled'`),
      dbGet(`SELECT COUNT(*) as v FROM orders`),
      dbGet(`SELECT COUNT(*) as v FROM users WHERE role = 'customer'`),
    ]);
    const stats = { totalRevenue: totalRevRow.v, totalOrders: totalOrdRow.v, totalCustomers: totalCustRow.v };

    const [revenueByDay, statusBreakdown, topProducts, categoryRevenue] = await Promise.all([
      dbAll(`SELECT strftime('%d %b', created_at) as day, COALESCE(SUM(total), 0) as revenue FROM orders WHERE created_at >= date('now', '-7 days') AND status != 'Cancelled' GROUP BY date(created_at) ORDER BY created_at ASC`),
      dbAll(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`),
      dbAll(`SELECT p.name, COUNT(o.id) as order_count, COALESCE(SUM(o.total), 0) as revenue FROM orders o JOIN products p ON json_extract(o.items, '$[0].productId') = p.id WHERE o.status != 'Cancelled' GROUP BY p.id ORDER BY revenue DESC LIMIT 5`),
      dbAll(`SELECT p.category, COALESCE(SUM(o.total), 0) as revenue FROM orders o JOIN products p ON json_extract(o.items, '$[0].productId') = p.id WHERE o.status != 'Cancelled' GROUP BY p.category ORDER BY revenue DESC`),
    ]);

    res.render('owner-analytics', { stats, revenueByDay, statusBreakdown, topProducts, categoryRevenue });
  } catch (err) {
    console.error(err);
    res.render('owner-analytics', { stats: {}, revenueByDay: [], statusBreakdown: [], topProducts: [], categoryRevenue: [] });
  }
});

// ─── API ──────────────────────────────────────────────────────────────────────
app.get('/api/notifications', isOwner, async (req, res) => {
  try {
    const row = await dbGet(`SELECT COUNT(*) as count FROM orders WHERE status = 'Pending Verification'`);
    res.json({ pendingOrders: row.count });
  } catch { res.json({ pendingOrders: 0 }); }
});

// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html><html><head><title>404</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;background:#fafafa}
    h1{font-size:5rem;margin:0;color:#f8bc45}p{color:#666;margin:8px 0 24px}a{background:#111;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700}</style>
    </head><body><h1>404</h1><p>Page not found</p><a href="/">Go Home</a></body></html>
  `);
});



app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).send('<h1>Something went wrong.</h1><a href="/">Go Home</a>');
});

// ─── START ────────────────────────────────────────────────────────────────────
// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Zila Collections running at http://localhost:${PORT}`);
  console.log(`👑 Admin login: http://localhost:${PORT}${OWNER_ROUTE}\n`);
});