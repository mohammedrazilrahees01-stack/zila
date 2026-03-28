# 🚀 Hostinger VPS Deployment Guide — Zila Collections

## Prerequisites
- Hostinger VPS plan (any tier works)
- SSH access to your VPS

---

## STEP 1: Connect to your VPS via SSH

```bash
ssh root@YOUR_VPS_IP
```
(Hostinger gives you the IP and root password in your hPanel)

---

## STEP 2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v   # Should show v18.x.x
```

---

## STEP 3: Install PM2 (keeps your app running 24/7)

```bash
npm install -g pm2
```

---

## STEP 4: Upload your project

**Option A — Using FileZilla (recommended for beginners):**
1. Open FileZilla
2. Host: YOUR_VPS_IP | User: root | Password: your_root_password | Port: 22
3. Upload the `zila-collections` folder to `/var/www/zila-collections`

**Option B — Using terminal:**
```bash
# On your LOCAL machine:
scp -r ./zila-collections root@YOUR_VPS_IP:/var/www/
```

---

## STEP 5: Install dependencies

```bash
cd /var/www/zila-collections
npm install
```

---

## STEP 6: Add your QR code

Upload your UPI QR image to:
```
/var/www/zila-collections/public/images/qr.png
```

---

## STEP 7: Update your .env file

```bash
nano /var/www/zila-collections/.env
```

Update these values:
- `OWNER_PASSWORD` — set a strong password
- `SESSION_SECRET` — change to something random
- `OWNER_LOGIN_ROUTE` — keep it secret!

---

## STEP 8: Start the app with PM2

```bash
cd /var/www/zila-collections
pm2 start app.js --name "zila-collections"
pm2 save
pm2 startup
```

Your site is now live at: `http://YOUR_VPS_IP:3000`

---

## STEP 9: Point your domain (if you have one)

In Hostinger hPanel → Domains → DNS Zone:
- Add A record: `@` → YOUR_VPS_IP
- Add A record: `www` → YOUR_VPS_IP

Then set up Nginx to forward port 80 → 3000:

```bash
apt-get install -y nginx

cat > /etc/nginx/sites-available/zila << 'NGINX'
server {
    listen 80;
    server_name zilacollections.com www.zilacollections.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -s /etc/nginx/sites-available/zila /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## STEP 10: Owner Login

Your secret owner panel URL is:
```
http://YOUR_DOMAIN/zila-owner-panel-access-2025
```
(Change this in your .env file — keep it secret!)

---

## ✅ You're Live!

PM2 commands you'll use:
```bash
pm2 status          # Check if running
pm2 logs zila-collections   # View logs
pm2 restart zila-collections  # Restart
```
