# Project Context - LM Ladies Tailor Billing System

## 1. What the Project Does
The **LM Ladies Tailor Billing System** is a full-stack web application designed for a tailoring business to manage customer relationships, order tracking, and financial analytics.
- **Customer Management**: Stores customer profiles, contact info, and their specific measurements.
- **Order Lifecycle**: Tracks orders from "Pending" to "Ready" and "Delivered". Each order can contain multiple services (e.g., stitching, embroidery).
- **Billing**: Generates PDF bills for customers and calculates balances/advances.
- **Worker Management**: A dedicated dashboard for workers to update the status of assigned work.
- **Analytics & Profits**: Tracks business expenses (including stitching labor) and calculates net profit over time.
- **PWA / Offline Support**: Works offline as a Progressive Web App, syncing data when a connection is restored.

## 2. Current Progress
- **Core Functionality**: Customer CRUD, order creation, and bill generation are fully implemented.
- **1:1 Measurement Model**: Restored and enforced a strict 1-to-1 relationship between customers and measurement records.
- **Database Indexing**: Added unique constraints to prevent data duplication.
- **Customer Editing**: Users can now edit customer names and phone numbers directly from their profiles.
- **Analytics**: Comprehensive dashboard for monthly, yearly, and all-time profit/loss tracking.
- **Deployment**: Configured for Vercel with LibSQL/Turso for persistent cloud storage.

## 3. Pending Tasks
- **Testing**: The local database has been cleared for a fresh round of user testing.
- **Data Entry**: Re-adding real/test data to verify the new 1:1 measurement constraints.
- **UI/UX Polishing**: Potential refinements based on user feedback during the testing phase.
- **Worker Features**: Potential expansion of the worker dashboard (e.g., more granular task tracking).

## 4. Key Architecture
- **Tech Stack**:
  - **Frontend**: React.js, Vite, custom CSS, Lucide-React icons.
  - **Backend**: Node.js, Express.
  - **Database**: LibSQL (using Turso for cloud and local SQLite for development).
- **Communication**: REST API using Axios with environment-based base URLs.
- **Schema Overview**:
  - `customers`: ID, Name, Phone Number.
  - `measurements`: Link to customer (UNIQUE), stores specific tailor dimensions.
  - `orders`: Links customer, tracks dates, totals, advances, and status.
  - `services`: Detailed line items for each order.
  - `expenses`: General business expenses.
  - `order_images` & `order_voice_notes`: Attachments for design references and instructions.

## 5. Important Links & Credentials
- **GitHub Repository**: https://github.com/KISHANMM/LM_TAILOR_BILLING_SYSTEM

- **Turso Database URL**: libsql://lm-tailor-db-kishanmagaji.aws-ap-south-1.turso.io

- **Turso Auth Token**: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4MTIzMjcsImlkIjoiMDE5Y2MzZDgtZDMwMS03NTJkLWIyZjEtOTdiMGM1ZTRkODc2IiwicmlkIjoiMTJlZGVjZGQtYmZhMy00ZDhmLWFhOTgtN2NiNDA4MDdhN2U2In0.gVqmcn4sRplpeQTRr8EkQuDH8e7pi8CcK3igelGBiFxZrhOkfTGL1YSrvf7A835IGBRfIE4WQDXKaBJD_b3rDA

