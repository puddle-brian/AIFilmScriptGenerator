# 🔧 Vercel Environment Variables Setup

## Required Environment Variables

After your deployment completes, you need to add these environment variables in the Vercel dashboard:

### **Step 1: Go to Vercel Dashboard**
1. Visit: https://vercel.com/dashboard
2. Click on your `film-script-generator` project
3. Go to **Settings** tab
4. Click **Environment Variables** in the sidebar

### **Step 2: Add Required Variables**

**DATABASE_URL** (Required)
```
Variable Name: DATABASE_URL
Value: your_neon_database_url_here
Environment: Production, Preview, Development
```

**ANTHROPIC_API_KEY** (Required)  
```
Variable Name: ANTHROPIC_API_KEY
Value: your_anthropic_api_key_here
Environment: Production, Preview, Development
```

**NODE_ENV** (Required)
```
Variable Name: NODE_ENV
Value: production
Environment: Production
```

### **Step 3: Optional Security Variables**

**ALLOWED_ORIGINS** (Recommended)
```
Variable Name: ALLOWED_ORIGINS
Value: https://your-app.vercel.app,https://film-script-generator.vercel.app
Environment: Production
```

**RATE_LIMIT_WINDOW_MS** (Optional)
```
Variable Name: RATE_LIMIT_WINDOW_MS
Value: 900000
Environment: Production
```

**RATE_LIMIT_MAX_REQUESTS** (Optional)
```
Variable Name: RATE_LIMIT_MAX_REQUESTS
Value: 100
Environment: Production
```

### **Step 4: Redeploy**
After adding environment variables:
1. Go to **Deployments** tab
2. Click the **three dots** on the latest deployment
3. Click **Redeploy**

## 🎯 Your Values

### **DATABASE_URL:**
This should be your Neon database connection string that looks like:
```
postgresql://username:password@host.neon.tech/database?sslmode=require
```

### **ANTHROPIC_API_KEY:**
Your Anthropic API key that starts with `sk-ant-`

### **Admin Access After Deployment:**
- Admin API Key: `admin_bfc0179645e270e4b8806c7206ee36a09b4625305cba978b73e6e45d2c416028`
- Admin has 10,000 credits available
- Users get 100 free credits when they register

## 🧪 Testing After Deployment

Once deployed and environment variables are set:

1. **Health Check:** `https://your-app.vercel.app/health`
2. **API Status:** `https://your-app.vercel.app/api/status`
3. **Main App:** `https://your-app.vercel.app`
4. **User Registration:** Test creating a new account
5. **Script Generation:** Test generating a story structure

## 🚨 Common Issues

**Issue: "API key not configured"**
- Solution: Make sure ANTHROPIC_API_KEY is set in environment variables

**Issue: "Database connection failed"**
- Solution: Verify DATABASE_URL is correct and includes `?sslmode=require`

**Issue: "Function timeout"**
- Solution: This is normal for first deployment, subsequent requests will be faster

## 🎉 Success!

Your Film Script Generator will be live at:
`https://your-chosen-name.vercel.app`

Features available immediately:
- ✅ User registration (100 free credits)
- ✅ AI script generation
- ✅ Credit system with usage tracking
- ✅ Admin dashboard
- ✅ Professional security and monitoring 