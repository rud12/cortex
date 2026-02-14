from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.causal import router as causal_router
from app.utils.response import success_response

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return success_response({'status': 'ok'}, 'Causal service healthy')


app.include_router(causal_router)
