"""项目 Blueprint（渐进提取中）"""
from flask import Blueprint

projects_bp = Blueprint('projects', __name__, url_prefix='/api/projects')
