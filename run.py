"""
论文搭子 ThesisBuddy - 模块化启动入口
使用 Flask 应用工厂创建应用。
用法: python run.py
"""
import os
import sys

# 确保项目根目录在 Python 路径中
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from backend.app import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') != 'production'
    print(f"[ThesisBuddy] 启动服务 http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
