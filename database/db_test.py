import mysql.connector
from mysql.connector import Error

def test_connection():
    try:
        # 1. Attempt to connect to the local XAMPP MySQL server
        connection = mysql.connector.connect(
            host='127.0.0.1',        # Your local machine
            user='root',             # The default XAMPP username
            password='',             # Keep this blank (matching your config)
            database='mr_diy_analytics' # The database container you created
        )

        if connection.is_connected():
            db_info = connection.server_info
            print(f"✅ Success! Connected to MySQL Server version: {db_info}")
            
            # 2. Test reading from the database to ensure privileges are correct
            cursor = connection.cursor()
            cursor.execute("SELECT branch_name FROM branches WHERE branch_id = 1;")
            record = cursor.fetchone()
            
            print(f"📌 Database Data Verification: Linked to '{record[0]}'")

    except Error as e:
        print(f"❌ Error while connecting to MySQL: {e}")
        
    finally:
        # 3. Always close the connection when done
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()
            print("🔒 MySQL connection is safely closed.")

if __name__ == "__main__":
    test_connection()