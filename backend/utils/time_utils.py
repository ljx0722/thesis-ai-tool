"""
时间工具：北京时区处理。
"""
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

BEIJING_TZ = ZoneInfo('Asia/Shanghai')


def now_beijing():
    return datetime.now(BEIJING_TZ)


def now_beijing_str(fmt='%Y-%m-%d %H:%M:%S'):
    return now_beijing().strftime(fmt)


def today_beijing():
    return now_beijing().date()
