# BetBook — MongoDB Atlas & Deployment Guide

BetBook is a private sports-betting portfolio tracker. It features a Netflix-style profile picker, individual PIN/passwords, an admin view for Naveen, and an encrypted MongoDB backend with secure session tokens.

---

## 🚀 Quick Step-by-Step Setup Guide

### Step 1: Get your MongoDB Atlas Connection String
1. Log in to [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Create a Free Cluster** (if you don't already have one):
   - Choose **M0 (Free)** tier.
   - Choose AWS / Mumbai (or your nearest region).
3. **Configure Network Access** (Crucial so friends can connect):
   - In the left sidebar, click **Network Access**.
   - Click **+ Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - Click **Confirm**.
4. **Create a Database User**:
   - In the left sidebar, click **Database Access**.
   - Click **+ Add New Database User**.
   - Authentication Method: **Password**.
   - Username: e.g. `betbook_admin`
   - Password: Click *Autogenerate Secure Password* (and copy it!).
   - Database User Privileges: `Read and write to any database`.
   - Click **Add User**.
5. **Copy the Connection String**:
   - Go to **Database** (or Clusters) in the left sidebar.
   - Click **Connect** next to your cluster.
   - Select **Drivers** (Node.js).
   - Copy the connection URI:
     ```
     mongodb+srv://betbook_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with the password you created in step 4, and add `/betbook` before the `?`:
     ```
     mongodb+srv://betbook_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/betbook?retryWrites=true&w=majority
     ```

---

### Step 2: Test Locally on your PC
1. In the `betbook` folder, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your `MONGODB_URI`.
3. Start the local server:
   ```bash
   npm start
   ```
4. Open your browser at [http://localhost:3000](http://localhost:3000).
5. You will see the **🟢 MongoDB Live** badge in the header, confirming you are connected directly to your cloud database!

---

### Step 3: Deploy to Vercel (To share 24/7 with friends)
1. Push this `betbook` directory to your GitHub account (make the repository **Private**).
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **Add New** > **Project** and import your `betbook` repository.
4. In the **Environment Variables** section, add these 4 variables:
   - `MONGODB_URI`: (your MongoDB Atlas connection string from Step 1)
   - `MONGODB_DB`: `betbook`
   - `JWT_SECRET`: (a random string of 32+ characters)
   - `ADMIN_NAME`: `naveen`
   - `ADMIN_SETUP_CODE`: (a secret PIN only you know, e.g. `naveen123`)
5. Click **Deploy**.
6. Vercel will give you a live URL (like `https://betbook-xxx.vercel.app`).
7. Send that URL to your friends!

---

## 👥 How Profiles & Admin Work
1. When you first open the site, tap **+ Add profile**.
2. Type `Naveen`. Because the name matches `ADMIN_NAME`, an **Admin Setup Code** field will appear. Enter your secret code.
3. Choose your password and starting bankroll. Naveen is now initialized as the master admin!
4. When your friends visit the link, they tap **+ Add profile**, type their name (e.g. Rohan, Priya), choose an avatar color, enter their own password, and set their bankroll.
5. Each friend only sees their own bets and trades.
6. As the admin, Naveen can click the **Everyone** tab to view everyone's records, open any friend's profile, edit their data, or reset their password.
