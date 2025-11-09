"""
Admin Management Router - Provides endpoints for admin user management and authentication
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import bcrypt
import secrets
from datetime import datetime
import sqlite3
from pathlib import Path

router = APIRouter(prefix="/api/admin", tags=["admin"])
security = HTTPBasic()

# Database path
DB_PATH = Path(__file__).parent.parent.parent.parent / "prisma" / "dev.db"

class AdminCreate(BaseModel):
    username: str
    password: str
    role: str = "admin"

class AdminUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None
    isActive: Optional[bool] = None

class AdminResponse(BaseModel):
    id: str
    username: str
    role: str
    isActive: bool
    lastLogin: Optional[str] = None
    createdAt: str
    updatedAt: str

class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str

def get_db_connection():
    """Get SQLite database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def verify_admin_credentials(credentials: HTTPBasicCredentials) -> dict:
    """Verify admin credentials for HTTP Basic Auth"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT * FROM Admin WHERE username = ? AND isActive = 1",
        (credentials.username,)
    )
    admin = cursor.fetchone()
    conn.close()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    if not verify_password(credentials.password, admin['passwordHash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    return dict(admin)

def get_current_admin(credentials: HTTPBasicCredentials = Depends(security)) -> dict:
    """Dependency to get current authenticated admin"""
    return verify_admin_credentials(credentials)

@router.post("/initialize", status_code=status.HTTP_201_CREATED)
async def initialize_admin():
    """
    Initialize the admin system with a default root user
    Only works if no admin users exist
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if any admin exists
    cursor.execute("SELECT COUNT(*) as count FROM Admin")
    count = cursor.fetchone()['count']
    
    if count > 0:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin system already initialized"
        )
    
    # Create default root admin
    admin_id = secrets.token_urlsafe(16)
    username = "root"
    password = "00000000"  # Default password (8 zeros)
    password_hash = hash_password(password)
    now = datetime.utcnow().isoformat()
    
    cursor.execute(
        """INSERT INTO Admin (id, username, passwordHash, role, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (admin_id, username, password_hash, "superadmin", 1, now, now)
    )
    
    conn.commit()
    conn.close()
    
    return JSONResponse(content={
        "message": "Admin system initialized successfully",
        "username": username,
        "defaultPassword": password,
        "warning": "Please change the default password immediately!"
    })

@router.get("/me")
async def get_current_admin_info(current_admin: dict = Depends(get_current_admin)):
    """Get current authenticated admin information"""
    return AdminResponse(
        id=current_admin['id'],
        username=current_admin['username'],
        role=current_admin['role'],
        isActive=bool(current_admin['isActive']),
        lastLogin=current_admin['lastLogin'],
        createdAt=current_admin['createdAt'],
        updatedAt=current_admin['updatedAt']
    )

@router.post("/change-password")
async def change_password(
    password_change: PasswordChange,
    current_admin: dict = Depends(get_current_admin)
):
    """Change current admin's password"""
    # Verify current password
    if not verify_password(password_change.currentPassword, current_admin['passwordHash']):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Hash new password
    new_password_hash = hash_password(password_change.newPassword)
    now = datetime.utcnow().isoformat()
    
    # Update password in database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE Admin SET passwordHash = ?, updatedAt = ? WHERE id = ?",
        (new_password_hash, now, current_admin['id'])
    )
    
    conn.commit()
    conn.close()
    
    return JSONResponse(content={
        "message": "Password changed successfully"
    })

@router.get("/list")
async def list_admins(current_admin: dict = Depends(get_current_admin)):
    """List all admin users (requires authentication)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM Admin ORDER BY createdAt DESC")
    admins = cursor.fetchall()
    conn.close()
    
    return [
        AdminResponse(
            id=admin['id'],
            username=admin['username'],
            role=admin['role'],
            isActive=bool(admin['isActive']),
            lastLogin=admin['lastLogin'],
            createdAt=admin['createdAt'],
            updatedAt=admin['updatedAt']
        )
        for admin in admins
    ]

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_admin(
    admin_data: AdminCreate,
    current_admin: dict = Depends(get_current_admin)
):
    """Create a new admin user (requires superadmin role)"""
    if current_admin['role'] != 'superadmin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can create new admin users"
        )
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if username already exists
    cursor.execute("SELECT id FROM Admin WHERE username = ?", (admin_data.username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create new admin
    admin_id = secrets.token_urlsafe(16)
    password_hash = hash_password(admin_data.password)
    now = datetime.utcnow().isoformat()
    
    cursor.execute(
        """INSERT INTO Admin (id, username, passwordHash, role, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (admin_id, admin_data.username, password_hash, admin_data.role, 1, now, now)
    )
    
    conn.commit()
    conn.close()
    
    return JSONResponse(content={
        "message": "Admin user created successfully",
        "id": admin_id,
        "username": admin_data.username
    })

@router.put("/{admin_id}")
async def update_admin(
    admin_id: str,
    admin_update: AdminUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    """Update an admin user"""
    if current_admin['role'] != 'superadmin' and current_admin['id'] != admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own account"
        )
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if admin exists
    cursor.execute("SELECT * FROM Admin WHERE id = ?", (admin_id,))
    admin = cursor.fetchone()
    if not admin:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found"
        )
    
    # Build update query
    updates = []
    params = []
    
    if admin_update.password:
        updates.append("passwordHash = ?")
        params.append(hash_password(admin_update.password))
    
    if admin_update.role and current_admin['role'] == 'superadmin':
        updates.append("role = ?")
        params.append(admin_update.role)
    
    if admin_update.isActive is not None and current_admin['role'] == 'superadmin':
        updates.append("isActive = ?")
        params.append(1 if admin_update.isActive else 0)
    
    if not updates:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid updates provided"
        )
    
    updates.append("updatedAt = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(admin_id)
    
    query = f"UPDATE Admin SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    
    conn.commit()
    conn.close()
    
    return JSONResponse(content={
        "message": "Admin user updated successfully"
    })

@router.delete("/{admin_id}")
async def delete_admin(
    admin_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    """Delete an admin user (requires superadmin role)"""
    if current_admin['role'] != 'superadmin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can delete admin users"
        )
    
    if current_admin['id'] == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM Admin WHERE id = ?", (admin_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found"
        )
    
    conn.commit()
    conn.close()
    
    return JSONResponse(content={
        "message": "Admin user deleted successfully"
    })

@router.post("/verify")
async def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    """Verify admin credentials (used for authentication)"""
    admin = verify_admin_credentials(credentials)
    
    # Update last login
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE Admin SET lastLogin = ? WHERE id = ?",
        (datetime.utcnow().isoformat(), admin['id'])
    )
    
    conn.commit()
    conn.close()
    
    return JSONResponse(content={
        "authenticated": True,
        "username": admin['username'],
        "role": admin['role']
    })
