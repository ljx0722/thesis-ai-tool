"""
统一响应格式。
"""
from flask import jsonify


def ok(data=None, **kwargs):
    """成功响应。"""
    body = {'success': True}
    if data is not None:
        body['data'] = data
    body.update(kwargs)
    return jsonify(body)


def error(message, status=400, **kwargs):
    """错误响应。"""
    body = {'success': False, 'error': message}
    body.update(kwargs)
    return jsonify(body), status
