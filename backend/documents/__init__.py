"""文档处理 Blueprint（渐进提取中）"""
from flask import Blueprint

documents_bp = Blueprint('documents', __name__, url_prefix='/api')
