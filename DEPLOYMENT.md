# MockStream Deployment Guide

This guide explains how to deploy MockStream with the frontend on Vercel and backend on Render.

## Prerequisites

- GitHub account with your code pushed to a repository
- Vercel account (free tier works)
- Render account (free tier works)
- MongoDB, PostgreSQL, or Redis instances (optional - can use SQLite for development)

## Backend Deployment (Render)

### 1. Push Code to GitHub

Ensure your backend code is pushed to a GitHub repository.

### 2. Create Render Service

1. Go to [render.com](https://render.com) and sign in
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: mockstream-backend
   - **Branch**: main
   - **Root Directory**: backend
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables (see below)
6. Click **Create Web Service**

### 3. Environment Variables (Render)

Add these environment variables in Render:

```
PORT=5000
DATABASE_URL=your_database_connection_string
REDIS_URL=your_redis_connection_string (optional)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
```

**Notes:**
- For development, you can skip Firebase variables (the app will run without auth)
- For production, use MongoDB Atlas or PostgreSQL for the database
- If no DATABASE_URL is provided, the app will use SQLite (not recommended for production)

### 4. Get Backend URL

After deployment, Render will provide a URL like:
```
https://mockstream-backend.onrender.com
```

Copy this URL - you'll need it for the frontend configuration.

## Frontend Deployment (Vercel)

### 1. Push Code to GitHub

Ensure your frontend code is pushed to a GitHub repository (can be same or different repo).

### 2. Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: frontend
   - **Build Command**: `npm run build`
   - **Output Directory**: dist
5. Add Environment Variables (see below)
6. Click **Deploy**

### 3. Environment Variables (Vercel)

Add these environment variables in Vercel:

```
VITE_API_URL=https://mockstream-backend.onrender.com
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

**Important:** Replace `https://mockstream-backend.onrender.com` with your actual Render backend URL.

### 4. Get Frontend URL

After deployment, Vercel will provide a URL like:
```
https://mockstream.vercel.app
```

## Post-Deployment Configuration

### 1. Update CORS (if needed)

If you encounter CORS issues, update the backend CORS configuration in `backend/server.js`:

```javascript
await fastify.register(cors, {
  origin: ['https://mockstream.vercel.app', 'http://localhost:5173']
});
```

### 2. Test the Deployment

1. Visit your frontend URL
2. Create an endpoint
3. Test the webhook ingestion endpoint
4. Verify WebSocket streaming works

### 3. Monitor Logs

- **Render**: View logs in your Render dashboard
- **Vercel**: View logs in your Vercel dashboard

## Troubleshooting

### Backend Issues

- **Database connection errors**: Verify DATABASE_URL is correct
- **Port binding**: Render automatically sets PORT, don't hardcode it
- **WebSocket issues**: Ensure Render supports WebSocket (free tier has limitations)

### Frontend Issues

- **API connection errors**: Verify VITE_API_URL matches your backend URL
- **Build failures**: Check Vercel build logs for dependency issues
- **Environment variables**: Ensure all required variables are set

### Firebase Issues

- **Auth errors**: Verify Firebase project configuration
- **Missing variables**: Check all FIREBASE_* variables are set correctly

## Cost Considerations

- **Vercel**: Free tier includes unlimited deployments, 100GB bandwidth/month
- **Render**: Free tier includes 512MB RAM, 0.1 CPU (spins down after 15min inactivity)
- **Database**: MongoDB Atlas free tier (512MB), PostgreSQL free tier on Render

For production, consider upgrading to paid tiers for better performance and uptime.

## Alternative: Docker Deployment

If you prefer self-hosting, see `DOCKER.md` for Docker deployment instructions.
