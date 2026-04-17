# 💊 PharmaCare — Pharmacy Management System

A full-stack pharmacy management dashboard built with **FastAPI**, **PostgreSQL** (raw SQL via psycopg2), and a modern dark-themed web UI.

> Built as a college DBMS project — demonstrates SQL queries, transactions, JOINs, constraints, and CRUD operations.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 Admin Login | Credential validation via SQL query |
| 📊 Dashboard | Stats cards, alerts, recent sales |
| 💊 Medicine CRUD | Add, view, search, edit, delete medicines |
| 🧾 Billing | Process sales with auto price calculation |
| 🚨 Alerts | Low stock (< 10) and expiry (< 30 days) warnings |
| 🔍 Search | Case-insensitive medicine search (ILIKE) |
| 🔄 Transactions | ACID-compliant sale processing |

---

## 🛠 Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Python FastAPI
- **Database:** PostgreSQL
- **DB Access:** Raw SQL queries via `psycopg2` (no ORM)

---

## 📁 Project Structure

```
project2/
├── backend/
│   ├── db.py                # Database connection & table initialization
│   └── main.py              # FastAPI app with all API endpoints
├── frontend/
│   ├── login.html           # Admin login page
│   ├── index.html           # Dashboard
│   ├── medicines.html       # Medicine inventory table
│   ├── add.html             # Add medicine form
│   ├── billing.html         # Billing / sales page
│   ├── style.css            # Styling (dark SaaS theme)
│   └── script.js            # Frontend logic
├── requirements.txt         # Python dependencies
├── HOW_TO_RUN.txt           # Setup & run instructions
├── PROJECT_EXPLANATION.txt  # Detailed DBMS explanation
└── README.md                # This file
```

---

## 🗄 Database Schema

**Database:** `pharmacy_db`

### `admin`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| username | VARCHAR(50) | UNIQUE, NOT NULL |
| password | VARCHAR(100) | NOT NULL |

### `medicines`
| Column | Type | Constraints |
|--------|------|-------------|
| medicine_id | SERIAL | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL |
| price | NUMERIC(10,2) | NOT NULL |
| quantity | INTEGER | NOT NULL |
| expiry_date | DATE | NOT NULL |

### `sales`
| Column | Type | Constraints |
|--------|------|-------------|
| sale_id | SERIAL | PRIMARY KEY |
| medicine_id | INTEGER | FOREIGN KEY → medicines |
| quantity_sold | INTEGER | NOT NULL |
| total_price | NUMERIC(10,2) | NOT NULL |
| sale_date | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Relationship:** `medicines (1) → (Many) sales`

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/login` | Verify admin credentials |
| GET | `/medicines` | List all medicines (supports `?search=`) |
| POST | `/medicines` | Add a new medicine |
| PUT | `/medicines/{id}` | Update a medicine |
| DELETE | `/medicines/{id}` | Delete a medicine |
| POST | `/sales` | Process a sale (with transaction) |
| GET | `/sales` | List all sales (JOIN query) |
| GET | `/alerts` | Get low stock + expiring medicines |
| GET | `/stats` | Dashboard summary counts |

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Create the database
```sql
CREATE DATABASE pharmacy_db;
```

### 3. Configure password
Edit `backend/db.py` and set your PostgreSQL password in `DB_CONFIG`.

### 4. Run the server
```bash
cd backend
uvicorn main:app --reload
```

### 5. Open in browser
```
http://localhost:8000
```

**Login:** `admin` / `admin123`

---

## 📚 DBMS Concepts Covered

- **DDL:** CREATE TABLE with constraints
- **DML:** INSERT, SELECT, UPDATE, DELETE
- **Transactions:** BEGIN, COMMIT, ROLLBACK (ACID)
- **JOINs:** Sales with medicine names
- **Aggregate Functions:** COUNT, SUM, COALESCE
- **Constraints:** PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, DEFAULT
- **Pattern Matching:** ILIKE for search
- **Date Operations:** CURRENT_DATE, INTERVAL
- **Parameterized Queries:** SQL injection prevention

---

## 📝 License

This project is for educational purposes (DBMS college project).
