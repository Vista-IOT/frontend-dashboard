#!/usr/bin/env python3
"""
Initialize default admin user if none exists
"""
import sqlite3
import bcrypt
import secrets
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "prisma" / "dev.db"

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def initialize_admin():
    """Initialize default root admin if no admins exist"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        # Check if any admin exists
        cursor.execute("SELECT COUNT(*) as count FROM Admin")
        count = cursor.fetchone()[0]
        
        if count > 0:
            print("✓ Admin user already exists")
            conn.close()
            return
        
        # Create default root admin
        admin_id = secrets.token_urlsafe(16)
        username = "root"
        password = "default"  # Default password
        password_hash = hash_password(password)
        now = datetime.utcnow().isoformat()
        
        cursor.execute(
            """INSERT INTO Admin (id, username, passwordHash, role, isActive, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (admin_id, username, password_hash, "superadmin", 1, now, now)
        )
        
        conn.commit()
        conn.close()
        
        print("=" * 70)
        print("✓ Default admin user created successfully!")
        print("=" * 70)
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print("=" * 70)
        print("⚠  IMPORTANT: Please change the default password from the dashboard!")
        print("=" * 70)
        
    except Exception as e:
        print(f"Error initializing admin: {e}")
        raise

if __name__ == "__main__":
    initialize_admin()
