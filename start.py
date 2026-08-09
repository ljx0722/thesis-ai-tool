"""
论文搭子 ThesisBuddy - 本地启动入口
用法: python start.py 或双击 启动.bat
"""
import os
from kg_server import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[ThesisBuddy] 启动服务 http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
