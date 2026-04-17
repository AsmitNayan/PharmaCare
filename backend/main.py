"""
Pharmacy Management System — FastAPI Backend
All database operations use raw SQL via psycopg2 (no ORM).
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import os

from db import get_connection, init_db

# ---------- Pydantic models (request bodies) ----------

class LoginRequest(BaseModel):
    username: str
    password: str

class MedicineCreate(BaseModel):
    name: str
    price: float
    quantity: int
    expiry_date: str  # YYYY-MM-DD

class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    expiry_date: Optional[str] = None

class SaleCreate(BaseModel):
    medicine_id: int
    quantity_sold: int

# ---------- Application setup ----------

app = FastAPI(title="Pharmacy Management System")

# Allow frontend to call API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# Initialize database tables on startup
@app.on_event("startup")
def on_startup():
    init_db()

# ---------- Serve HTML pages ----------

@app.get("/")
def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

@app.get("/dashboard")
def serve_dashboard():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/medicines-page")
def serve_medicines():
    return FileResponse(os.path.join(FRONTEND_DIR, "medicines.html"))

@app.get("/add-page")
def serve_add():
    return FileResponse(os.path.join(FRONTEND_DIR, "add.html"))

@app.get("/billing-page")
def serve_billing():
    return FileResponse(os.path.join(FRONTEND_DIR, "billing.html"))


# =============================================
#  AUTH ENDPOINTS
# =============================================

@app.post("/login")
def login(req: LoginRequest):
    """
    Verify admin credentials using a raw SQL SELECT query.
    Returns success/failure message.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Parameterized query prevents SQL injection
        cur.execute(
            "SELECT id, username FROM admin WHERE username = %s AND password = %s;",
            (req.username, req.password),
        )
        row = cur.fetchone()

        if row is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        return {"message": "Login successful", "admin_id": row[0], "username": row[1]}

    finally:
        cur.close()
        conn.close()


# =============================================
#  MEDICINE ENDPOINTS (CRUD)
# =============================================

@app.get("/medicines")
def get_medicines(search: Optional[str] = None):
    """
    Fetch all medicines. Optionally filter by name (search).
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        if search:
            # ILIKE = case-insensitive pattern matching (PostgreSQL)
            cur.execute(
                "SELECT medicine_id, name, price, quantity, expiry_date "
                "FROM medicines WHERE name ILIKE %s ORDER BY name;",
                (f"%{search}%",),
            )
        else:
            cur.execute(
                "SELECT medicine_id, name, price, quantity, expiry_date "
                "FROM medicines ORDER BY name;"
            )

        rows = cur.fetchall()

        medicines = []
        for r in rows:
            medicines.append({
                "medicine_id": r[0],
                "name": r[1],
                "price": float(r[2]),
                "quantity": r[3],
                "expiry_date": r[4].isoformat(),
            })

        return medicines

    finally:
        cur.close()
        conn.close()


@app.post("/medicines")
def add_medicine(med: MedicineCreate):
    """
    Insert a new medicine using a raw INSERT query.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO medicines (name, price, quantity, expiry_date) "
            "VALUES (%s, %s, %s, %s) RETURNING medicine_id;",
            (med.name, med.price, med.quantity, med.expiry_date),
        )
        new_id = cur.fetchone()[0]
        conn.commit()

        return {"message": "Medicine added successfully", "medicine_id": new_id}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    finally:
        cur.close()
        conn.close()


@app.put("/medicines/{medicine_id}")
def update_medicine(medicine_id: int, med: MedicineUpdate):
    """
    Update an existing medicine. Only non-null fields are updated.
    Uses dynamic SQL construction with parameterized values.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Build SET clause dynamically based on provided fields
        fields = []
        values = []

        if med.name is not None:
            fields.append("name = %s")
            values.append(med.name)
        if med.price is not None:
            fields.append("price = %s")
            values.append(med.price)
        if med.quantity is not None:
            fields.append("quantity = %s")
            values.append(med.quantity)
        if med.expiry_date is not None:
            fields.append("expiry_date = %s")
            values.append(med.expiry_date)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(medicine_id)

        query = f"UPDATE medicines SET {', '.join(fields)} WHERE medicine_id = %s;"
        cur.execute(query, tuple(values))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Medicine not found")

        conn.commit()
        return {"message": "Medicine updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    finally:
        cur.close()
        conn.close()


@app.delete("/medicines/{medicine_id}")
def delete_medicine(medicine_id: int):
    """
    Delete a medicine by its ID.
    Also deletes related sales records (cascading manually).
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Delete related sales first (maintain referential integrity)
        cur.execute("DELETE FROM sales WHERE medicine_id = %s;", (medicine_id,))

        # Then delete the medicine
        cur.execute("DELETE FROM medicines WHERE medicine_id = %s;", (medicine_id,))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Medicine not found")

        conn.commit()
        return {"message": "Medicine deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    finally:
        cur.close()
        conn.close()


# =============================================
#  SALES ENDPOINTS
# =============================================

@app.post("/sales")
def create_sale(sale: SaleCreate):
    """
    Process a sale:
    1. Check available stock
    2. Reduce medicine quantity
    3. Insert sale record
    Uses a TRANSACTION (BEGIN → COMMIT / ROLLBACK) for consistency.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Begin transaction
        conn.autocommit = False

        # Step 1: Check current stock
        cur.execute(
            "SELECT quantity, price, name FROM medicines WHERE medicine_id = %s;",
            (sale.medicine_id,),
        )
        row = cur.fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Medicine not found")

        current_qty, unit_price, med_name = row[0], float(row[1]), row[2]

        if sale.quantity_sold > current_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {current_qty}",
            )

        # Step 2: Calculate total price
        total_price = unit_price * sale.quantity_sold

        # Step 3: Reduce stock
        cur.execute(
            "UPDATE medicines SET quantity = quantity - %s WHERE medicine_id = %s;",
            (sale.quantity_sold, sale.medicine_id),
        )

        # Step 4: Insert sale record
        cur.execute(
            "INSERT INTO sales (medicine_id, quantity_sold, total_price) "
            "VALUES (%s, %s, %s) RETURNING sale_id;",
            (sale.medicine_id, sale.quantity_sold, total_price),
        )
        sale_id = cur.fetchone()[0]

        # Commit transaction
        conn.commit()

        return {
            "message": "Sale completed successfully",
            "sale_id": sale_id,
            "medicine_name": med_name,
            "quantity_sold": sale.quantity_sold,
            "total_price": total_price,
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    finally:
        cur.close()
        conn.close()


@app.get("/sales")
def get_sales():
    """
    Fetch all sales with medicine names (JOIN query).
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT s.sale_id, m.name, s.quantity_sold, s.total_price, s.sale_date
            FROM sales s
            JOIN medicines m ON s.medicine_id = m.medicine_id
            ORDER BY s.sale_date DESC;
        """)
        rows = cur.fetchall()

        sales = []
        for r in rows:
            sales.append({
                "sale_id": r[0],
                "medicine_name": r[1],
                "quantity_sold": r[2],
                "total_price": float(r[3]),
                "sale_date": r[4].strftime("%Y-%m-%d %H:%M"),
            })

        return sales

    finally:
        cur.close()
        conn.close()


# =============================================
#  ALERTS ENDPOINT
# =============================================

@app.get("/alerts")
def get_alerts():
    """
    Return medicines that are low on stock (quantity < 10)
    or expiring within 30 days.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Low stock: quantity < 10
        cur.execute(
            "SELECT medicine_id, name, price, quantity, expiry_date "
            "FROM medicines WHERE quantity < 10 ORDER BY quantity ASC;"
        )
        low_stock = []
        for r in cur.fetchall():
            low_stock.append({
                "medicine_id": r[0],
                "name": r[1],
                "price": float(r[2]),
                "quantity": r[3],
                "expiry_date": r[4].isoformat(),
            })

        # Expiring soon: within 30 days from today
        cur.execute(
            "SELECT medicine_id, name, price, quantity, expiry_date "
            "FROM medicines WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days' "
            "ORDER BY expiry_date ASC;"
        )
        expiring = []
        for r in cur.fetchall():
            expiring.append({
                "medicine_id": r[0],
                "name": r[1],
                "price": float(r[2]),
                "quantity": r[3],
                "expiry_date": r[4].isoformat(),
            })

        return {"low_stock": low_stock, "expiring": expiring}

    finally:
        cur.close()
        conn.close()


# =============================================
#  DASHBOARD STATS
# =============================================

@app.get("/stats")
def get_stats():
    """
    Return summary counts for the dashboard cards.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Total medicines
        cur.execute("SELECT COUNT(*) FROM medicines;")
        total = cur.fetchone()[0]

        # Low stock count
        cur.execute("SELECT COUNT(*) FROM medicines WHERE quantity < 10;")
        low_stock = cur.fetchone()[0]

        # Expiring within 30 days
        cur.execute(
            "SELECT COUNT(*) FROM medicines "
            "WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days';"
        )
        expiring = cur.fetchone()[0]

        # Total sales today
        cur.execute(
            "SELECT COALESCE(SUM(total_price), 0) FROM sales "
            "WHERE sale_date::date = CURRENT_DATE;"
        )
        today_sales = float(cur.fetchone()[0])

        return {
            "total_medicines": total,
            "low_stock": low_stock,
            "expiring_soon": expiring,
            "today_sales": today_sales,
        }

    finally:
        cur.close()
        conn.close()
