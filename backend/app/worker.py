from celery import Celery
from .config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

app = Celery(
    'bim_worker',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['app.tasks']
)

app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
)
