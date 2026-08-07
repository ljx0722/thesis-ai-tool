"""文献管理 Blueprint（渐进提取中）"""
from flask import Blueprint

literature_bp = Blueprint('literature', __name__, url_prefix='/api')
