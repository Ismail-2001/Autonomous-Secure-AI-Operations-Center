import uvicorn

if __name__ == "__main__":
    uvicorn.run("src.asoc.api.app:app", host="0.0.0.0", port=9002, reload=True)
