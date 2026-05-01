import sqlite3
import os

db_path = "/home/khush-ramgaria/Downloads/JOSHI/bimdesign/backend/bim.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN drawing JSON;")
        print("Column 'drawing' added successfully.")
    except sqlite3.OperationalError as e:
        print(f"Skipping: {e}")
    conn.commit()
    conn.close()
else:
    print("Database file not found.")
