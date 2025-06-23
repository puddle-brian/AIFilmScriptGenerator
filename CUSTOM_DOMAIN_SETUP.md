# 🌐 Custom Domain Setup Guide

## **Option 1: Vercel + Your Domain (Recommended)**

### **Step 1: Complete Vercel Deployment**
After running `vercel --prod`, you'll get a URL like: `https://film-script-generator-abc123.vercel.app`

### **Step 2: Add Your Custom Domain**

**Via Vercel Dashboard:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to "Settings" → "Domains"
4. Add your domain (e.g., `scriptgen.yourdomain.com`)

**Via CLI:**
```bash
vercel domains add scriptgen.yourdomain.com
```

### **Step 3: Configure DNS Records**

**For Subdomain (e.g., scriptgen.yourdomain.com):**
- Type: `CNAME`
- Name: `scriptgen`
- Value: `cname.vercel-dns.com`

**For Root Domain (e.g., yourdomain.com):**
- Type: `A`
- Name: `@`
- Value: `76.76.19.61`

**Alternative - Use Cloudflare (Recommended):**
- Type: `CNAME`
- Name: `scriptgen`
- Value: `your-app.vercel.app`
- Proxy Status: ✅ Proxied

### **Step 4: Set Environment Variables**
```bash
vercel env add DATABASE_URL
vercel env add ANTHROPIC_API_KEY
vercel env add ALLOWED_ORIGINS
```

---

## **Option 2: Railway + Your Domain**

### **Step 1: Deploy to Railway**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### **Step 2: Add Custom Domain**
```bash
railway domain add scriptgen.yourdomain.com
```

### **Step 3: Configure DNS**
- Type: `CNAME`
- Name: `scriptgen`
- Value: `your-app.up.railway.app`

---

## **Option 3: Your Own VPS/Server**

### **Step 1: Server Setup (Ubuntu/Debian)**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

### **Step 2: Deploy Your App**
```bash
# Clone your repository
git clone https://github.com/yourusername/FilmScriptGenerator.git
cd FilmScriptGenerator

# Install dependencies
npm install

# Create production environment file
cp env-template.txt .env
# Edit .env with your production values

# Start with PM2
pm2 start server.js --name "film-script-generator"
pm2 startup
pm2 save
```

### **Step 3: Configure Nginx**
```bash
sudo nano /etc/nginx/sites-available/scriptgen.yourdomain.com
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name scriptgen.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable Site:**
```bash
sudo ln -s /etc/nginx/sites-available/scriptgen.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **Step 4: SSL Certificate (Let's Encrypt)**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d scriptgen.yourdomain.com
```

---

## **🔧 Environment Variables for Production**

### **Required Variables:**
```env
DATABASE_URL=your_neon_database_url
ANTHROPIC_API_KEY=your_anthropic_api_key
NODE_ENV=production
ALLOWED_ORIGINS=https://scriptgen.yourdomain.com
SESSION_SECRET=your_strong_random_secret
JWT_SECRET=your_jwt_secret
```

### **Optional Performance Variables:**
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
PORT=3000
```

---

## **🚀 Quick Start Commands**

### **Vercel (Fastest)**
```bash
vercel --prod
vercel domains add scriptgen.yourdomain.com
```

### **Railway**
```bash
railway up
railway domain add scriptgen.yourdomain.com
```

### **Manual Server**
```bash
pm2 start server.js --name film-script-generator
sudo nginx -t && sudo systemctl restart nginx
```

---

## **✅ Post-Deployment Checklist**

- [ ] Custom domain resolves correctly
- [ ] SSL certificate installed and working
- [ ] Environment variables set
- [ ] Database connection working
- [ ] API endpoints responding
- [ ] Credit system functional
- [ ] Authentication working
- [ ] Rate limiting active
- [ ] Monitoring/logging enabled

---

## **🔍 Testing Your Deployment**

### **1. Basic Health Check**
```bash
curl https://scriptgen.yourdomain.com/health
```

### **2. API Status Check**
```bash
curl https://scriptgen.yourdomain.com/api/status
```

### **3. Authentication Test**
```bash
curl -X POST https://scriptgen.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"testpass123"}'
```

### **4. Credit System Test**
```bash
curl https://scriptgen.yourdomain.com/api/model-pricing
```

---

## **💡 Pro Tips**

1. **Use Cloudflare** for additional security and performance
2. **Set up monitoring** with UptimeRobot or similar
3. **Enable backups** for your database
4. **Use environment-specific configs** for different stages
5. **Set up CI/CD** with GitHub Actions for automatic deployments

Your Film Script Generator is production-ready! 🎬✨ 