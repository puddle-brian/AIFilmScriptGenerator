# 🎬 ScreenplayGenie.com Domain Setup Guide

## 🚨 **Issue**: "Invalid Configuration" Error

When adding `screenplaygenie.com` to Vercel, you're getting an "invalid configuration" error because root domains require specific DNS setup.

## ✅ **Solution**: Proper DNS Configuration

### **Step 1: Add Domain in Vercel Dashboard**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project
3. Go to **Settings** → **Domains**
4. Add BOTH domains:
   - `screenplaygenie.com` (root domain)
   - `www.screenplaygenie.com` (www subdomain)

### **Step 2: Configure DNS Records**

**Go to your domain registrar's DNS settings and add these records:**

#### **For Root Domain (screenplaygenie.com):**
```
Type: A
Name: @
Value: 76.76.19.61
TTL: Auto or 3600
```

#### **For WWW Subdomain (www.screenplaygenie.com):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto or 3600
```

### **Step 3: Alternative Method (If A Record Doesn't Work)**

Some registrars have issues with A records. Use CNAME flattening instead:

#### **Root Domain Alternative:**
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: Auto or 3600
```

**Note**: Not all registrars support CNAME for root domains. If yours doesn't, use the A record method above.

## 🌐 **DNS Configuration by Popular Registrars**

### **GoDaddy:**
1. Go to GoDaddy DNS Management
2. Add A record: `@` → `76.76.19.61`
3. Add CNAME record: `www` → `cname.vercel-dns.com`

### **Namecheap:**
1. Go to Advanced DNS settings
2. Add A record: `@` → `76.76.19.61`
3. Add CNAME record: `www` → `cname.vercel-dns.com`

### **Cloudflare:**
1. Go to DNS settings
2. Add A record: `@` → `76.76.19.61` (🟠 Proxied)
3. Add CNAME record: `www` → `cname.vercel-dns.com` (🟠 Proxied)

### **Google Domains:**
1. Go to DNS settings
2. Add A record: `@` → `76.76.19.61`
3. Add CNAME record: `www` → `cname.vercel-dns.com`

## 🔄 **Step-by-Step Process**

### **1. First, Add Both Domains in Vercel:**
- `screenplaygenie.com`
- `www.screenplaygenie.com`

### **2. Then Configure DNS:**
Wait for Vercel to show you the exact DNS records needed. They might be slightly different.

### **3. Verify DNS Propagation:**
Use [whatsmydns.net](https://www.whatsmydns.net) to check if your DNS changes have propagated globally.

### **4. Wait for SSL:**
Vercel will automatically provision SSL certificates once DNS is properly configured.

## 🛠️ **Troubleshooting**

### **If "Invalid Configuration" Persists:**

1. **Remove and Re-add Domain:**
   - Remove `screenplaygenie.com` from Vercel
   - Wait 5 minutes
   - Add it again

2. **Check DNS First:**
   - Set up DNS records BEFORE adding domain to Vercel
   - Use [dig](https://toolbox.googleapps.com/apps/dig/) to verify A record points to `76.76.19.61`

3. **Try WWW First:**
   - Add `www.screenplaygenie.com` first
   - Once that works, add the root domain

4. **Contact Support:**
   - If issues persist, check Vercel's support documentation
   - Some registrars have specific requirements

## 🎯 **Expected Results**

After proper DNS setup:
- `screenplaygenie.com` → Your app
- `www.screenplaygenie.com` → Your app  
- Both will have SSL certificates
- Vercel will show "Valid Configuration"

## ⚡ **Quick Commands to Test**

### **Check DNS:**
```bash
# Check A record
nslookup screenplaygenie.com

# Check CNAME
nslookup www.screenplaygenie.com
```

### **Test After Setup:**
```bash
# Test root domain
curl -I https://screenplaygenie.com/health

# Test www subdomain  
curl -I https://www.screenplaygenie.com/health
```

## 🔐 **Environment Variables Update**

After domain setup, update your environment variables:

```env
ALLOWED_ORIGINS=https://screenplaygenie.com,https://www.screenplaygenie.com
```

## 🎉 **Success Checklist**

- [ ] Both domains added in Vercel dashboard
- [ ] DNS A record: `@` → `76.76.19.61`
- [ ] DNS CNAME record: `www` → `cname.vercel-dns.com`
- [ ] DNS propagation complete (check with whatsmydns.net)
- [ ] SSL certificates issued by Vercel
- [ ] Both URLs load your app successfully
- [ ] Environment variables updated

Your ScreenplayGenie.com will be live! 🎬✨ 