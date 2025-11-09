# Frontdesk — AI Receptionist (Coding Assessment)

This project was developed as part of the **Frontdesk Company Coding Assessment**.  
It implements a **voice-enabled receptionist** web app using React (Vite), Firebase, and a Node.js + Express backend with Firestore integration.  
The solution is deployed with **Render (backend)** and **Vercel (frontend)**.

---



##  Project Overview

The project simulates an **AI Receptionist** that handles help requests in real time.  
A **caller** creates a help request → a **supervisor (admin)** answers it → the caller receives a **spoken reply** using Text-to-Speech.

###  Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Database | Firebase Firestore |
| Auth | Firebase Auth + Admin SDK |
| Deployment | Vercel (frontend) + Render (backend) |
| Optional | LiveKit for real-time voice publishing |

---

##  Project Structure:
### How to run locally (short)
1. Backend:
```bash
cd backend
npm install
npm start
2. Frontend:
```bash
cd frontend
npm install
npm run dev

git clone https://github.com/<your-username>/frontdesk-assessment.git
cd frontdesk-assessment

