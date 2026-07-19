"""
论文搭子 ThesisBuddy - 一键启动
"""
import subprocess, sys, webbrowser, time, os

script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

def main():
    print("=" * 50)
    print("  论文搭子 ThesisBuddy")
    print("  http://localhost:5000")
    print("=" * 50)
    print()

    # 检查并安装依赖
    for pkg, desc in [("flask", "Flask"), ("requests", "HTTP库")]:
        try:
            __import__(pkg)
            print(f"[OK] {desc} 已就绪")
        except ImportError:
            print(f"[安装] {desc}...")
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", pkg, "-q", "--disable-pip-version-check"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            print(f"[OK] {desc} 安装完成")

    print()
    print("[启动] Flask 服务...")

    kwargs = {"cwd": script_dir}
    if os.name == 'nt':
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

    flask_proc = subprocess.Popen([sys.executable, "kg_server.py"], **kwargs)
    time.sleep(2)

    webbrowser.open("http://localhost:5000")

    print("=" * 50)
    print("  访问: http://localhost:5000")
    print("  关闭此窗口停止服务")
    print("=" * 50)

    try:
        flask_proc.wait()
    except KeyboardInterrupt:
        print("\n[停止] 关闭中...")
        flask_proc.terminate()
        flask_proc.wait()

if __name__ == "__main__":
    main()
