"""
论文搭子 ThesisBuddy - 启动入口
统一使用 kg_server:app (单体 Flask 应用)
用法: python run.py
"""
import os
from kg_server import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') != 'production'
    print(f"[ThesisBuddy] 启动服务 http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
