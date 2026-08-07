"""知识图谱 Blueprint（渐进提取中）"""
from flask import Blueprint

kg_bp = Blueprint('knowledge_graph', __name__, url_prefix='/api')
