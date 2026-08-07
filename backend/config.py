"""
论文搭子 ThesisBuddy - 配置
所有配置通过环境变量设置，提供合理的默认值。
"""
import os

# 数据库
DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'thesis.db'))
DB_PATH = os.path.abspath(DB_PATH)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# 存储目录
MATERIALS_DIR = os.environ.get('MATERIALS_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'materials'))
os.makedirs(MATERIALS_DIR, exist_ok=True)

SNAPSHOTS_DIR = os.environ.get('SNAPSHOTS_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'snapshots'))
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

RESULTS_DIR = os.path.abspath(os.environ.get('RESULTS_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'results')))
os.makedirs(RESULTS_DIR, exist_ok=True)

# 数据集配置
DATASET_RESULT_MAX_BYTES = int(os.environ.get('DATASET_RESULT_MAX_BYTES', '1073741824'))
if DATASET_RESULT_MAX_BYTES < 1:
    raise RuntimeError('DATASET_RESULT_MAX_BYTES 必须为正整数')

DATASET_RECIPE_MAX_BYTES = int(os.environ.get('DATASET_RECIPE_MAX_BYTES', str(1024 * 1024)))
DATASET_WORKER_LEASE_SECONDS = max(30, int(os.environ.get('DATASET_WORKER_LEASE_SECONDS', '180')))
DATASET_WORKER_MAX_ATTEMPTS = max(1, int(os.environ.get('DATASET_WORKER_MAX_ATTEMPTS', '3')))

# 应用版本
APP_VERSION = os.environ.get('APP_VERSION', '0.9.0')
BUILD_SHA = os.environ.get('BUILD_SHA', 'dev')
BUILD_TIME = os.environ.get('BUILD_TIME', '')

# JWT 密钥
JWT_SECRET_PATH = os.path.join(os.path.dirname(DB_PATH), '.jwt_secret')
