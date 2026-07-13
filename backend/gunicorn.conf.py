import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", 2))
timeout = 120
keepalive = 5
errorlog = "-"
accesslog = "-"
loglevel = "info"
