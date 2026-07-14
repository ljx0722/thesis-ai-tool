import sqlite3
conn = sqlite3.connect('/app/data/thesis.db')
u = conn.execute("SELECT credits FROM users WHERE username='admin'").fetchone()
print(f'Before: {u[0]} decipoints = {u[0]/10} points')
conn.execute("UPDATE users SET credits = credits + 500 WHERE username='admin'")
conn.commit()
u2 = conn.execute("SELECT credits FROM users WHERE username='admin'").fetchone()
print(f'After: {u2[0]} decipoints = {u2[0]/10} points')
conn.close()
